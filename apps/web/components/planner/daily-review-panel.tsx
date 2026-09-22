"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Loader2, NotebookPen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { easeFast } from "@/lib/motion";
import { parseIso, toIso } from "@/lib/planner";

type Envelope = { data: any };
type DayItem = {
  date: string;
  summary: string | null;
  reflection: string | null;
  mood: number | null;
  totalTasks: number;
  doneTasks: number;
  plannedMinutes: number;
  doneMinutes: number;
  hasReview: boolean;
};

const MOODS = ["😵", "😐", "🙂", "😎", "✨"] as const;

function weekdayLabel(dateIso: string, days: string[]) {
  const d = parseIso(dateIso);
  return days[d.getDay() === 0 ? 6 : d.getDay() - 1] ?? dateIso;
}

/**
 * 每日总结与反思。
 * 数据存在服务端（/planner/daily），手机端与电脑端同一账号看到同一份记录。
 */
export function DailyReviewPanel({ days = 7 }: { days?: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [todayIso, setTodayIso] = useState("");
  const [openDate, setOpenDate] = useState<string | null>(null);

  useEffect(() => {
    setTodayIso(toIso(new Date()));
  }, []);

  const list = useQuery<Envelope>({
    queryKey: ["planner-daily", days],
    queryFn: () => apiFetch(`/planner/daily/range?days=${days}`),
  });
  const items: DayItem[] = useMemo(
    () => list.data?.data?.items || [],
    [list.data],
  );

  // 默认展开今天
  useEffect(() => {
    if (todayIso && openDate === null) setOpenDate(todayIso);
  }, [todayIso, openDate]);

  const save = useMutation({
    mutationFn: ({
      date,
      summary,
      reflection,
      mood,
    }: {
      date: string;
      summary: string;
      reflection: string;
      mood: number | null;
    }) =>
      apiFetch(`/planner/daily?date=${date}`, {
        method: "PUT",
        body: JSON.stringify({ summary, reflection, mood }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planner-daily"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
    },
  });

  const dayNames = t("planner.days") as unknown as string[];
  // 最近的日子排在最上面（接口返回的是倒序：今天在前）
  const ordered = items;

  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/40 p-5">
      <SectionHeader
        title={t("planner.dailyReviewTitle")}
        subtitle={t("planner.dailyReviewDesc")}
      />
      {list.isLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="mt-3 space-y-2">
          {ordered.map((item) => (
            <DayRow
              key={item.date}
              item={item}
              label={weekdayLabel(item.date, dayNames)}
              isToday={item.date === todayIso}
              open={openDate === item.date}
              onToggle={() => setOpenDate((prev) => (prev === item.date ? null : item.date))}
              onSave={(payload) =>
                save.mutate({ date: item.date, ...payload })
              }
              saving={save.isPending}
              t={t}
            />
          ))}
          {ordered.length === 0 && (
            <p className="py-4 text-center text-[12px] text-text-tertiary">
              {t("planner.noDailyData")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DayRow({
  item,
  label,
  isToday,
  open,
  onToggle,
  onSave,
  saving,
  t,
}: {
  item: DayItem;
  label: string;
  isToday: boolean;
  open: boolean;
  onToggle: () => void;
  onSave: (payload: { summary: string; reflection: string; mood: number | null }) => void;
  saving: boolean;
  t: (key: string) => string;
}) {
  const [summary, setSummary] = useState(item.summary ?? "");
  const [reflection, setReflection] = useState(item.reflection ?? "");
  const [mood, setMood] = useState<number | null>(item.mood ?? null);

  // 服务端数据回来后同步到表单（切天/刷新时）
  useEffect(() => {
    setSummary(item.summary ?? "");
    setReflection(item.reflection ?? "");
    setMood(item.mood ?? null);
  }, [item.date, item.summary, item.reflection, item.mood]);

  const dirty =
    summary !== (item.summary ?? "") ||
    reflection !== (item.reflection ?? "") ||
    mood !== (item.mood ?? null);

  return (
    <div
      className={`rounded-[12px] border ${
        isToday ? "border-primary/40 bg-primary/5" : "border-border-subtle bg-surface/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <NotebookPen className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <span className="text-[12px] font-semibold text-text">
          {label}
          <span className="ml-1.5 font-normal text-text-tertiary">{item.date.slice(5)}</span>
        </span>
        {isToday && <Badge variant="primary">{t("planner.today")}</Badge>}
        {mood && <span className="text-[13px]">{MOODS[mood - 1]}</span>}
        <span className="ml-auto text-[11px] text-text-tertiary">
          {item.doneTasks}/{item.totalTasks} {t("planner.tasksCount")} · {item.doneMinutes}
          {t("planner.minutes")}
        </span>
        {item.hasReview && <Badge variant="success">{t("planner.reviewed")}</Badge>}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={easeFast}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-border-subtle px-3 py-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                  {t("planner.dailyMood")}
                </p>
                <div className="flex gap-1.5">
                  {MOODS.map((emoji, index) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setMood(index + 1)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-[15px] transition ${
                        mood === index + 1
                          ? "border-primary bg-primary/10"
                          : "border-border-subtle hover:border-primary/50"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                  {t("planner.dailySummary")}
                </p>
                <Textarea
                  rows={2}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  placeholder={t("planner.dailySummaryHint")}
                />
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                  {t("planner.dailyReflection")}
                </p>
                <Textarea
                  rows={3}
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  placeholder={t("planner.dailyReflectionHint")}
                />
              </div>

              <Button
                size="sm"
                variant={dirty ? "primary" : "ghost"}
                disabled={saving || !dirty}
                onClick={() => onSave({ summary, reflection, mood })}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {t("planner.saveDaily")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
