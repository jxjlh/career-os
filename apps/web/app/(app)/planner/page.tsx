"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  Languages,
  Lightbulb,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Target,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge, Button, EmptyState, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { WeekCalendar } from "@/components/planner/week-calendar";
import { DailyReviewPanel } from "@/components/planner/daily-review-panel";
import { WeekTrend } from "@/components/planner/week-trend";
import { apiFetch } from "@/lib/api";
import { getLifeGoals } from "@/lib/life";
import { useI18n } from "@/lib/i18n";
import { easeStandard, easeFast, useTaskCompleteFeedback } from "@/lib/motion";
import {
  formatWeekRange,
  getWeekSummaries,
  parseIso,
  shiftWeeks,
  toIso,
  type WeekSummary,
} from "@/lib/planner";

type Envelope = { data: any };

const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  learning: <BookOpen className="h-3.5 w-3.5" />,
  practice: <Wrench className="h-3.5 w-3.5" />,
  project: <Rocket className="h-3.5 w-3.5" />,
  review: <Search className="h-3.5 w-3.5" />,
  english: <Languages className="h-3.5 w-3.5" />,
  reading: <BookOpen className="h-3.5 w-3.5" />,
  rest: <Sparkles className="h-3.5 w-3.5" />,
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-success",
  medium: "bg-warning",
  hard: "bg-danger",
};

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-l-primary",
  medium: "border-l-border",
  low: "border-l-border-subtle",
};

export default function PlannerPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewReflection, setReviewReflection] = useState("");
  // null = 本周；否则是选中周的周一 ISO 日期（看历史计划用）
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [todayIso, setTodayIso] = useState("");
  // 正在给哪一天添加任务 + 草稿
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMinutes, setDraftMinutes] = useState("30");

  // 挂载后再算「今天」，避免服务端/客户端时间不同导致 hydration 不一致
  useEffect(() => {
    setTodayIso(toIso(new Date()));
  }, []);

  const weeksQuery = useQuery<WeekSummary[]>({
    queryKey: ["planner-weeks", 16],
    queryFn: () => getWeekSummaries(16),
  });
  const weeks = weeksQuery.data ?? [];
  // 「本周」以服务端返回的 isCurrent 为准，客户端时间只做兜底
  const currentWeekStart = weeks.find((w) => w.isCurrent)?.weekStart ?? "";

  const isCurrentWeek = selectedWeek === null;
  const activeWeek = selectedWeek ?? currentWeekStart;

  const plan = useQuery<Envelope>({
    queryKey: isCurrentWeek ? ["planner-current"] : ["planner-week", selectedWeek],
    queryFn: () =>
      isCurrentWeek
        ? apiFetch("/planner/current")
        : apiFetch(`/planner/week?weekStart=${selectedWeek}`),
  });

  const { data: lifeGoals } = useQuery({
    queryKey: ["life-goals"],
    queryFn: () => getLifeGoals(),
  });

  const generate = useMutation({
    mutationFn: () => {
      const activeGoals = (lifeGoals || []).filter(
        (g: any) => g.status === "pending" || g.status === "in_progress"
      );
      // 本周内到期的目标优先；其余活跃目标最多再带 5 个，避免目标过多稀释计划
      const ws = new Date();
      ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const isThisWeek = (g: any) => {
        if (!g.targetDate) return false;
        const d = new Date(g.targetDate);
        return d >= ws && d < we;
      };
      const weekGoals = activeGoals.filter(isThisWeek);
      const rest = activeGoals.filter((g: any) => !isThisWeek(g)).slice(0, 5);
      const goalIds = [...weekGoals, ...rest].map((g: any) => g.id);
      return apiFetch("/planner/generate", {
        method: "POST",
        body: JSON.stringify({ weeklyStudyMinutes: 420, goalIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/planner/tasks/${taskId}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/planner/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
    },
  });

  /** 手动改每天的任务：标题/时长/类型/难度/优先级/挪到别的天 */
  const updateTask = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: any }) =>
      apiFetch(`/planner/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
      queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
    },
  });

  /** 在指定天手动加一条任务 */
  const addTask = useMutation({
    mutationFn: ({ day, title, minutes }: { day: number; title: string; minutes: number }) =>
      apiFetch("/planner/tasks", {
        method: "POST",
        body: JSON.stringify({ title, day, estimatedMinutes: minutes }),
      }),
    onSuccess: () => {
      setAddingDay(null);
      setDraftTitle("");
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
    },
  });

  const submitReview = useMutation({
    mutationFn: () => {
      const planId = plan.data?.data?.id;
      if (!planId) throw new Error("no plan");
      return apiFetch(`/planner/${planId}/review`, {
        method: "POST",
        body: JSON.stringify({ summary: reviewSummary, reflection: reviewReflection }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-week"] });
      queryClient.invalidateQueries({ queryKey: ["planner-weeks"] });
    },
  });

  const planData = plan.data?.data ?? null;
  const tasks = planData?.tasks || [];
  /** 选中的历史周没有计划 */
  const weekHasNoPlan = !plan.isLoading && !isCurrentWeek && !planData;

  // 同步复盘文本 (plan 加载后填回)
  useEffect(() => {
    if (planData?.summary) setReviewSummary(planData.summary);
    if (planData?.reflection) setReviewReflection(planData.reflection);
  }, [planData?.summary, planData?.reflection]);

  const completionPct = Math.round((planData?.completionRate ?? 0) * 100);

  const selectWeek = (weekStart: string) => {
    setSelectedWeek(weekStart === currentWeekStart ? null : weekStart);
    setExpandedTaskId(null);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("planner.title")}
        subtitle={
          isCurrentWeek
            ? planData?.weekStart || ""
            : `${formatWeekRange(activeWeek)}${planData ? "" : ` · ${t("planner.noPlanThatWeek")}`}`
        }
        action={
          isCurrentWeek ? (
            <Button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              variant="primary"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {planData?.aiGenerated ? t("planner.regenerate") : t("planner.generate")}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setSelectedWeek(null)}>
              <CalendarClock className="h-4 w-4" />
              {t("planner.backToCurrent")}
            </Button>
          )
        }
      />

      {/* ── 最顶端：历史周完成率可视化 ── */}
      <WeekTrend
        weeks={weeks}
        selectedWeek={activeWeek}
        onSelect={selectWeek}
        title={t("planner.historyTitle")}
        emptyHint={t("planner.historyEmpty")}
      />

      {/* ── 日历：按周切换历史计划 ── */}
      <WeekCalendar
        weeks={weeks}
        selectedWeek={activeWeek}
        onSelect={selectWeek}
        todayIso={todayIso}
        footHint={t("planner.calendarHint")}
        weekLabel={t("planner.weekLabel")}
        noPlanLabel={t("planner.noPlanThatWeek")}
        backToThisWeekLabel={t("planner.backToCurrent")}
        isCurrentSelected={isCurrentWeek}
        onBackToCurrent={() => setSelectedWeek(null)}
      />

      {plan.isLoading ? (
        <Skeleton className="h-64" />
      ) : weekHasNoPlan ? (
        <EmptyState
          title={t("planner.weekNoPlanTitle")}
          description={t("planner.weekNoPlanDesc")}
          action={
            <Button variant="primary" size="sm" onClick={() => setSelectedWeek(null)}>
              <CalendarClock className="h-4 w-4" />
              {t("planner.backToCurrent")}
            </Button>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={t("planner.empty")}
          description={t("planner.emptyDesc")}
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t("planner.emptyCta")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* ── 顶部: 进度条 + 本周寄语 ── */}
          <ProgressHeader
            completionPct={completionPct}
            completedTasks={planData?.completedTasks ?? 0}
            totalTasks={planData?.totalTasks ?? 0}
            completedMinutes={planData?.completedMinutes ?? 0}
            totalMinutes={planData?.totalMinutes ?? 0}
            weeklyMinutesBudget={planData?.weeklyMinutesBudget ?? null}
            weeklyFocus={planData?.weeklyFocus}
            rationale={planData?.rationale}
            tips={planData?.tips || []}
          />

          {/* ── 本周到期的人生目标 ── */}
          <WeekGoalsSection goals={planData?.weekGoals || []} />

          {/* ── 英语学习进度 ── */}
          <EnglishSection snapshot={planData?.contextSnapshot?.english} />

          {/* ── 7 列网格 ── */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
              const dayTasks = tasks.filter((task: any) => task.day === day);
              const dayDone = dayTasks.filter((t: any) => t.status === "done").length;
              // 只有查看「本周」时才高亮今天那一列
              const todayWeekday = todayIso
                ? parseIso(todayIso).getDay() === 0
                  ? 7
                  : parseIso(todayIso).getDay()
                : -1;
              const isToday = isCurrentWeek && day === todayWeekday;
              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: (day - 1) * 0.03, ease: "easeOut" }}
                  className={`flex min-h-[240px] flex-col rounded-[14px] border bg-surface/40 p-3 ${
                    isToday ? "border-primary/40 shadow-[0_0_24px_-12px_var(--primary-glow)]" : "border-border-subtle"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
                      {(t("planner.days") as unknown as string[])[day - 1]}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {dayDone}/{dayTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dayTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        expanded={expandedTaskId === task.id}
                        onToggleExpand={() =>
                          setExpandedTaskId((prev) => (prev === task.id ? null : task.id))
                        }
                        onToggleStatus={() => toggleTask.mutate(task.id)}
                        onDelete={() => deleteTask.mutate(task.id)}
                        onSave={(payload) => updateTask.mutate({ taskId: task.id, payload })}
                        saving={updateTask.isPending}
                        t={t}
                      />
                    ))}
                    {dayTasks.length === 0 && (
                      <p className="py-4 text-center text-[11px] text-text-tertiary">—</p>
                    )}

                    {/* 手动给这一天加任务 */}
                    {isCurrentWeek &&
                      (addingDay === day ? (
                        <div className="space-y-1.5 rounded-[10px] border border-border-subtle bg-surface/60 p-2">
                          <input
                            autoFocus
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && draftTitle.trim()) {
                                addTask.mutate({
                                  day,
                                  title: draftTitle.trim(),
                                  minutes: Number(draftMinutes) || 30,
                                });
                              }
                              if (event.key === "Escape") setAddingDay(null);
                            }}
                            placeholder={t("planner.addTaskPlaceholder")}
                            className="w-full rounded-[8px] border border-border-subtle bg-transparent px-2 py-1.5 text-[12px] text-text outline-none focus:border-primary/60"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={10}
                              max={600}
                              value={draftMinutes}
                              onChange={(event) => setDraftMinutes(event.target.value)}
                              className="w-16 rounded-[8px] border border-border-subtle bg-transparent px-2 py-1 text-[11px] text-text outline-none focus:border-primary/60"
                            />
                            <span className="text-[10px] text-text-tertiary">
                              {t("planner.minutes")}
                            </span>
                            <Button
                              size="sm"
                              variant="primary"
                              className="ml-auto"
                              disabled={!draftTitle.trim() || addTask.isPending}
                              onClick={() =>
                                addTask.mutate({
                                  day,
                                  title: draftTitle.trim(),
                                  minutes: Number(draftMinutes) || 30,
                                })
                              }
                            >
                              {addTask.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              {t("planner.addTask")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingDay(day);
                            setDraftTitle("");
                            setDraftMinutes("30");
                          }}
                          className="flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed border-border-subtle py-1.5 text-[11px] text-text-tertiary transition-colors hover:border-primary/50 hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                          {t("planner.addTask")}
                        </button>
                      ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── 每日总结与反思（服务端存储，多端同步） ── */}
          {isCurrentWeek && <DailyReviewPanel days={7} />}

          {/* ── 周复盘区 ── */}
          <ReviewSection
            summary={reviewSummary}
            reflection={reviewReflection}
            onSummaryChange={setReviewSummary}
            onReflectionChange={setReviewReflection}
            onSubmit={() => submitReview.mutate()}
            isSubmitting={submitReview.isPending}
            submitted={planData?.status === "reviewed"}
            readOnly={!isCurrentWeek}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 子组件: 顶部进度 + 寄语
// ──────────────────────────────────────────────────────────────────────

function ProgressHeader({
  completionPct,
  completedTasks,
  totalTasks,
  completedMinutes,
  totalMinutes,
  weeklyMinutesBudget,
  weeklyFocus,
  rationale,
  tips,
}: {
  completionPct: number;
  completedTasks: number;
  totalTasks: number;
  completedMinutes: number;
  totalMinutes: number;
  weeklyMinutesBudget: number | null;
  weeklyFocus: string | null;
  rationale: string | null;
  tips: string[];
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/50 p-5">
      {/* 进度条 */}
      <div className="flex items-end justify-between gap-6">
        <div className="flex items-baseline gap-2">
          <motion.span
            key={completionPct}
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            transition={easeStandard}
            className="font-display text-[44px] font-bold leading-none tracking-tight text-text"
          >
            {completionPct}
            <span className="text-[22px] text-text-secondary">%</span>
          </motion.span>
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            {t("planner.completion")}
          </span>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="font-display text-[16px] font-semibold text-text">
              {completedTasks}/{totalTasks}
            </p>
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              {t("planner.tasksCount")}
            </p>
          </div>
          <div>
            <p className="font-display text-[16px] font-semibold text-text">
              {completedMinutes}/{totalMinutes}
            </p>
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              {t("planner.minutes")}
              {weeklyMinutesBudget ? ` / ${weeklyMinutesBudget}` : ""}
            </p>
          </div>
        </div>
      </div>
      {/* 进度条 */}
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-elevated">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
          initial={{ width: 0 }}
          animate={{ width: `${completionPct}%` }}
          transition={easeStandard}
        />
      </div>

      {/* 本周寄语 */}
      {weeklyFocus && (
        <div className="mt-5 flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ai" />
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {t("planner.weeklyFocus")}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-text">{weeklyFocus}</p>
          </div>
        </div>
      )}

      {/* 为什么这样安排 */}
      {rationale && (
        <div className="mt-4 flex items-start gap-2.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
              {t("planner.rationale")}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{rationale}</p>
          </div>
        </div>
      )}

      {/* 超预算提示 */}
      {weeklyMinutesBudget != null && totalMinutes > weeklyMinutesBudget && (
        <div className="mt-4 flex items-start gap-2.5">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-[12px] leading-relaxed text-warning">
            {t("planner.overBudget")} {totalMinutes - weeklyMinutesBudget} {t("planner.minutes")}
          </p>
        </div>
      )}

      {/* AI tips */}
      {tips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tips.map((tip, i) => (
            <span
              key={i}
              className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] text-primary"
            >
              {tip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 子组件: 本周到期的人生目标
// ──────────────────────────────────────────────────────────────────────

function WeekGoalsSection({ goals }: { goals: any[] }) {
  const { t } = useI18n();
  const days = t("planner.days") as unknown as string[];

  return (
    <div className="rounded-[16px] border border-primary/25 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
          {t("planner.weekGoalsTitle")}
        </h3>
        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
          {goals.length}
        </span>
      </div>

      {goals.length === 0 ? (
        <p className="text-[12px] text-text-tertiary">
          {t("planner.noWeekGoals")}
          {" · "}
          <Link href="/life/goals" className="text-primary hover:underline">
            {t("planner.weekGoalsHint")}
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {goals.map((g: any) => {
            const daysLeft = g.daysLeft;
            const dueLabel =
              daysLeft === null || daysLeft === undefined
                ? t("planner.weekGoalDue")
                : daysLeft < 0
                ? t("planner.weekGoalOverdue")
                : daysLeft === 0
                ? t("planner.weekGoalToday")
                : `${daysLeft} ${t("planner.weekGoalDaysLeft")}`;
            return (
              <Link
                key={g.id}
                href={`/life/goals/detail?id=${g.id}`}
                className="block rounded-[10px] border border-border-subtle bg-surface/60 p-3 transition-colors hover:bg-surface-elevated/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text">{g.title}</p>
                    {g.subTasks?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {g.subTasks.slice(0, 3).map((s: any) => (
                          <li key={s.id} className="text-[11px] text-text-tertiary">
                            · {s.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                        daysLeft !== null && daysLeft !== undefined && daysLeft < 0
                          ? "bg-danger/12 text-danger"
                          : "bg-warning/12 text-warning"
                      }`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {dueLabel}
                    </span>
                    {g.targetDate && (
                      <p className="mt-1 text-[10px] text-text-tertiary">
                        {g.targetDate}
                        {g.dayIndex ? ` · ${days[g.dayIndex - 1] ?? ""}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 子组件: 英语学习进度
// ──────────────────────────────────────────────────────────────────────

function EnglishSection({ snapshot }: { snapshot: any }) {
  const { t } = useI18n();

  if (!snapshot || !snapshot.active) {
    return (
      <div className="rounded-[16px] border border-border-subtle bg-surface/40 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Languages className="h-4 w-4 text-text-tertiary" />
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            {t("planner.englishTitle")}
          </h3>
        </div>
        <p className="text-[12px] text-text-tertiary">{t("planner.noEnglishData")}</p>
      </div>
    );
  }

  const books = (snapshot.books || []).slice(0, 2);
  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-cyan-500" />
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            {t("planner.englishTitle")}
          </h3>
        </div>
        <div className="flex gap-4 text-right text-[11px] text-text-tertiary">
          <span>
            {t("planner.englishStreak")}{" "}
            <b className="text-text">{snapshot.streakDays ?? 0}</b>
          </span>
          <span>
            {t("planner.englishMinutes")}{" "}
            <b className="text-text">{snapshot.minutesThisWeek ?? 0}</b>
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {books.map((b: any) => (
          <div key={b.bookId}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-text">
                {b.name}
                <span className="ml-1 text-[10px] text-text-tertiary">{b.level}</span>
              </span>
              <span className="text-text-tertiary">
                {t("planner.englishLearned")} {b.learnedCount}/{b.totalWords} ·{" "}
                {b.progressPercent}% · {t("planner.englishDue")} {b.dueCount}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${Math.min(100, b.progressPercent ?? 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 子组件: 任务卡片
// ──────────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  expanded,
  onToggleExpand,
  onToggleStatus,
  onDelete,
  onSave,
  saving = false,
  t,
}: {
  task: any;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onSave: (payload: any) => void;
  saving?: boolean;
  t: (key: string) => string;
}) {
  const { playing, trigger } = useTaskCompleteFeedback();
  const isDone = task.status === "done";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    minutes: String(task.estimatedMinutes ?? 60),
    day: String(task.day ?? 1),
    taskType: task.taskType ?? "learning",
    difficulty: task.difficulty ?? "medium",
    priority: task.priority ?? "medium",
    notes: task.notes ?? "",
  });

  // 服务端数据更新后同步草稿
  useEffect(() => {
    setDraft({
      title: task.title,
      minutes: String(task.estimatedMinutes ?? 60),
      day: String(task.day ?? 1),
      taskType: task.taskType ?? "learning",
      difficulty: task.difficulty ?? "medium",
      priority: task.priority ?? "medium",
      notes: task.notes ?? "",
    });
  }, [task]);

  const commitEdit = () => {
    onSave({
      title: draft.title.trim(),
      estimatedMinutes: Number(draft.minutes) || 60,
      day: Number(draft.day) || 1,
      taskType: draft.taskType,
      difficulty: draft.difficulty,
      priority: draft.priority,
      notes: draft.notes,
    });
    setEditing(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone) trigger();
    onToggleStatus();
  };

  const typeLabel = task.taskType ? (t(`planner.taskType.${task.taskType}`) as string) : "";
  const typeIcon = task.taskType ? TASK_TYPE_ICON[task.taskType] : null;
  const difficultyColor = task.difficulty ? DIFFICULTY_COLOR[task.difficulty] : "bg-surface-elevated";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: isDone ? 0.55 : 1,
        y: 0,
        scale: playing ? 1.02 : 1,
      }}
      transition={easeFast}
      className={`group cursor-pointer rounded-[10px] border-l-2 bg-surface/60 p-2.5 transition-colors hover:bg-surface-elevated/60 ${
        task.priority ? PRIORITY_BORDER[task.priority] : "border-l-border"
      }`}
      onClick={onToggleExpand}
    >
      <div className="flex items-start gap-2">
        {/* 完成切换圆形 checkbox */}
        <motion.button
          type="button"
          onClick={handleToggle}
          whileTap={{ scale: 0.85 }}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
            isDone
              ? "border-primary bg-primary text-white shadow-[0_0_12px_var(--primary-glow)]"
              : "border-border text-transparent hover:border-primary/60"
          }`}
          aria-label="toggle"
        >
          {isDone && <Check className="h-3 w-3" />}
        </motion.button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[13px] font-medium leading-snug ${
              isDone ? "text-text-tertiary line-through" : "text-text"
            }`}
          >
            {task.title}
          </p>

          {/* 标签行 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {typeIcon && typeLabel && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
                {typeIcon}
                {typeLabel}
              </span>
            )}
            {task.difficulty && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${difficultyColor}`}
                title={t(`planner.difficulty.${task.difficulty}`) as string}
              />
            )}
            <span className="text-[10px] text-text-tertiary">{task.estimatedMinutes}m</span>
            {task.aiGenerated && (
              <span className="rounded-full bg-ai/10 px-1.5 py-0.5 text-[10px] text-ai">AI</span>
            )}
          </div>

          {/* 关联标签 */}
          {(task.goalName || task.skillName || task.milestoneName) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.goalName && (
                <Link
                  href={`/life/goals/detail?id=${task.goalId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-primary hover:underline"
                >
                  #{task.goalName}
                </Link>
              )}
              {task.skillName && (
                <a
                  href={`/skills?skill=${task.skillId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  #{task.skillName}
                </a>
              )}
              {task.milestoneName && (
                <span className="text-[10px] text-pink-400">
                  #{task.milestoneName}
                </span>
              )}
              {task.taskType === "english" && (
                <a
                  href="/english"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-cyan-500 hover:underline"
                >
                  #英语
                </a>
              )}
            </div>
          )}

          {/* 展开详情 */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={easeStandard}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2 border-t border-border-subtle pt-2">
                  {task.description && (
                    <p className="whitespace-pre-line text-[12px] leading-relaxed text-text-secondary">
                      {task.description}
                    </p>
                  )}
                  {task.estimatedOutcome && (
                    <p className="text-[11px] text-text-tertiary">
                      <span className="font-semibold">{t("planner.estimatedOutcome")}:</span>{" "}
                      {task.estimatedOutcome}
                    </p>
                  )}
                  {task.resourceUrl && (
                    <a
                      href={task.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <Search className="h-3 w-3" />
                      {task.resourceUrl.length > 40
                        ? task.resourceUrl.slice(0, 40) + "..."
                        : task.resourceUrl}
                    </a>
                  )}
                  {task.notes && !editing && (
                    <p className="text-[11px] text-text-tertiary">{task.notes}</p>
                  )}

                  {/* ── 编辑这条任务（AI 生成后也能改） ── */}
                  {editing ? (
                    <div className="space-y-2 rounded-[10px] bg-surface-muted/40 p-2">
                      <input
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, title: event.target.value }))
                        }
                        className="w-full rounded-[8px] border border-border-subtle bg-transparent px-2 py-1.5 text-[12px] text-text outline-none focus:border-primary/60"
                        placeholder={t("planner.addTaskPlaceholder")}
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1 text-[10px] text-text-tertiary">
                          {t("planner.minutes")}
                          <input
                            type="number"
                            min={10}
                            max={600}
                            value={draft.minutes}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, minutes: event.target.value }))
                            }
                            className="w-16 rounded-[8px] border border-border-subtle bg-transparent px-1.5 py-1 text-[11px] text-text outline-none focus:border-primary/60"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-text-tertiary">
                          {t("planner.moveToDay")}
                          <select
                            value={draft.day}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, day: event.target.value }))
                            }
                            className="rounded-[8px] border border-border-subtle bg-transparent px-1.5 py-1 text-[11px] text-text outline-none focus:border-primary/60"
                          >
                            {(t("planner.days") as unknown as string[]).map((label, index) => (
                              <option key={label} value={String(index + 1)}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <select
                          value={draft.taskType}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, taskType: event.target.value }))
                          }
                          className="rounded-[8px] border border-border-subtle bg-transparent px-1.5 py-1 text-[11px] text-text outline-none focus:border-primary/60"
                        >
                          {["learning", "practice", "project", "review", "english", "reading", "rest"].map(
                            (value) => (
                              <option key={value} value={value}>
                                {t(`planner.taskType.${value}`) as string}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          value={draft.difficulty}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, difficulty: event.target.value }))
                          }
                          className="rounded-[8px] border border-border-subtle bg-transparent px-1.5 py-1 text-[11px] text-text outline-none focus:border-primary/60"
                        >
                          {["easy", "medium", "hard"].map((value) => (
                            <option key={value} value={value}>
                              {t(`planner.difficulty.${value}`) as string}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!draft.title.trim() || saving}
                          onClick={(event) => {
                            event.stopPropagation();
                            commitEdit();
                          }}
                        >
                          {saving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {t("planner.saveTask")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(false);
                          }}
                        >
                          {t("planner.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditing(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-text-secondary transition-colors hover:text-primary"
                    >
                      <Pencil className="h-3 w-3" />
                      {t("planner.editTask")}
                    </button>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="text-[10px] text-text-tertiary transition-colors hover:text-danger"
                    >
                      <Trash2 className="mr-0.5 inline h-3 w-3" />
                      {t("planner.deleteTask")}
                    </button>
                    <ChevronDown className="h-3 w-3 text-text-tertiary" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 子组件: 周复盘
// ──────────────────────────────────────────────────────────────────────

function ReviewSection({
  summary,
  reflection,
  onSummaryChange,
  onReflectionChange,
  onSubmit,
  isSubmitting,
  submitted,
  readOnly = false,
  t,
}: {
  summary: string;
  reflection: string;
  onSummaryChange: (v: string) => void;
  onReflectionChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitted: boolean;
  readOnly?: boolean;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
          {t("planner.reviewTitle")}
        </h3>
        {submitted && <Badge variant="success">{t("planner.reviewSubmitted")}</Badge>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            {t("planner.reviewSummary")}
          </label>
          <Textarea
            rows={3}
            value={summary}
            disabled={readOnly}
            onChange={(e) => onSummaryChange(e.target.value)}
            placeholder="本周完成了什么、收获了什么..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            {t("planner.reviewReflection")}
          </label>
          <Textarea
            rows={3}
            value={reflection}
            disabled={readOnly}
            onChange={(e) => onReflectionChange(e.target.value)}
            placeholder="哪里做得不够好、下周如何调整..."
          />
        </div>
        <Button variant="primary" size="sm" onClick={onSubmit} disabled={isSubmitting || readOnly}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("planner.submitReview")}
        </Button>
        {readOnly && (
          <p className="text-[11px] text-text-tertiary">{t("planner.reviewReadOnly")}</p>
        )}
      </div>
    </div>
  );
}
