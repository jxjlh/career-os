"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  Rocket,
  Search,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge, Button, EmptyState, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getLifeGoals } from "@/lib/life";
import { useI18n } from "@/lib/i18n";
import { easeStandard, easeFast, useTaskCompleteFeedback } from "@/lib/motion";

type Envelope = { data: any };

const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  learning: <BookOpen className="h-3.5 w-3.5" />,
  practice: <Wrench className="h-3.5 w-3.5" />,
  project: <Rocket className="h-3.5 w-3.5" />,
  review: <Search className="h-3.5 w-3.5" />,
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

  const plan = useQuery<Envelope>({
    queryKey: ["planner-current"],
    queryFn: () => apiFetch("/planner/current"),
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
      const goalIds = activeGoals.map((g: any) => g.id);
      return apiFetch("/planner/generate", {
        method: "POST",
        body: JSON.stringify({ weeklyStudyMinutes: 420, goalIds }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const toggleTask = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/planner/tasks/${taskId}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/planner/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const planData = plan.data?.data;
  const tasks = planData?.tasks || [];

  // 同步复盘文本 (plan 加载后填回)
  useEffect(() => {
    if (planData?.summary) setReviewSummary(planData.summary);
    if (planData?.reflection) setReviewReflection(planData.reflection);
  }, [planData?.summary, planData?.reflection]);

  const completionPct = Math.round((planData?.completionRate ?? 0) * 100);

  return (
    <div>
      <SectionHeader
        title={t("planner.title")}
        subtitle={planData?.weekStart || ""}
        action={
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
        }
      />

      {plan.isLoading ? (
        <Skeleton className="h-64" />
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
            weeklyFocus={planData?.weeklyFocus}
            rationale={planData?.rationale}
            tips={planData?.tips || []}
          />

          {/* ── 7 列网格 ── */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
              const dayTasks = tasks.filter((task: any) => task.day === day);
              const dayDone = dayTasks.filter((t: any) => t.status === "done").length;
              const today = new Date().getDay();
              const todayIdx = today === 0 ? 7 : today; // 1-7
              const isToday = day === todayIdx;
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
                        t={t}
                      />
                    ))}
                    {dayTasks.length === 0 && (
                      <p className="py-4 text-center text-[11px] text-text-tertiary">—</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── 周复盘区 ── */}
          <ReviewSection
            summary={reviewSummary}
            reflection={reviewReflection}
            onSummaryChange={setReviewSummary}
            onReflectionChange={setReviewReflection}
            onSubmit={() => submitReview.mutate()}
            isSubmitting={submitReview.isPending}
            submitted={planData?.status === "reviewed"}
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
  weeklyFocus,
  rationale,
  tips,
}: {
  completionPct: number;
  completedTasks: number;
  totalTasks: number;
  completedMinutes: number;
  totalMinutes: number;
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
// 子组件: 任务卡片
// ──────────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  expanded,
  onToggleExpand,
  onToggleStatus,
  onDelete,
  t,
}: {
  task: any;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const { playing, trigger } = useTaskCompleteFeedback();
  const isDone = task.status === "done";

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
                  href={`/life/goals/${task.goalId}`}
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
                  {task.notes && (
                    <p className="text-[11px] text-text-tertiary">{task.notes}</p>
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
  t,
}: {
  summary: string;
  reflection: string;
  onSummaryChange: (v: string) => void;
  onReflectionChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitted: boolean;
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
            onChange={(e) => onReflectionChange(e.target.value)}
            placeholder="哪里做得不够好、下周如何调整..."
          />
        </div>
        <Button variant="primary" size="sm" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("planner.submitReview")}
        </Button>
      </div>
    </div>
  );
}
