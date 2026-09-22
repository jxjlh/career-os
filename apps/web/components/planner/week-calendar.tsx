"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import {
  buildMonthRows,
  formatMonthLabel,
  parseIso,
  toIso,
  type WeekSummary,
} from "@/lib/planner";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function rowTone(week: WeekSummary | undefined): string {
  if (!week || week.totalTasks === 0) return "";
  if (week.completionRate >= 0.999) return "bg-primary/12";
  if (week.completionRate >= 0.6) return "bg-primary/8";
  if (week.completionRate > 0) return "bg-primary/5";
  return "bg-surface-elevated/40";
}

/**
 * 月历 —— 每周一行，行底色按该周完成率深浅，点击任意一行切换到那一周的周计划。
 */
export function WeekCalendar({
  weeks,
  selectedWeek,
  onSelect,
  todayIso,
  footHint,
  weekLabel,
  noPlanLabel,
  backToThisWeekLabel,
  isCurrentSelected,
  onBackToCurrent,
}: {
  weeks: WeekSummary[];
  selectedWeek: string;
  onSelect: (weekStart: string) => void;
  todayIso: string;
  footHint: string;
  weekLabel: string;
  noPlanLabel: string;
  backToThisWeekLabel: string;
  isCurrentSelected: boolean;
  onBackToCurrent: () => void;
}) {
  const weekMap = new Map(weeks.map((w) => [w.weekStart, w]));
  const [cursor, setCursor] = useState(() => {
    const d = parseIso(selectedWeek);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // 选中周跨月时，日历跟着翻到对应月份
  useEffect(() => {
    const d = parseIso(selectedWeek);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [selectedWeek]);

  const rows = buildMonthRows(cursor);
  const cursorMonth = cursor.getMonth();

  const shiftMonth = (delta: number) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/40 p-4">
      {/* 头部 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-full border border-border-subtle p-1 text-text-secondary transition-colors hover:border-primary/40 hover:text-text"
            aria-label="上个月"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-display text-[13px] font-semibold text-text">
            {formatMonthLabel(cursor)}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-full border border-border-subtle p-1 text-text-secondary transition-colors hover:border-primary/40 hover:text-text"
            aria-label="下个月"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {!isCurrentSelected && (
          <button
            type="button"
            onClick={onBackToCurrent}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/16"
          >
            {backToThisWeekLabel}
          </button>
        )}
      </div>

      {/* 星期表头 */}
      <div className="mb-1 grid grid-cols-[repeat(7,1fr)_52px] gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <span
            key={w}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary"
          >
            {w}
          </span>
        ))}
        <span className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">
          {weekLabel}
        </span>
      </div>

      {/* 周行 */}
      <div className="space-y-1">
        {rows.map((row) => {
          const weekStart = row[0];
          const week = weekMap.get(weekStart);
          const hasPlan = !!week && week.totalTasks > 0;
          const isSelected = weekStart === selectedWeek;
          const pct = hasPlan ? Math.round((week as WeekSummary).completionRate * 100) : 0;

          return (
            <button
              key={weekStart}
              type="button"
              onClick={() => onSelect(weekStart)}
              title={
                hasPlan
                  ? `${weekStart} ~ ${(week as WeekSummary).weekEnd}｜完成 ${(week as WeekSummary).completedTasks}/${(week as WeekSummary).totalTasks}（${pct}%）`
                  : `${weekStart} 起 ${noPlanLabel}`
              }
              className={`grid w-full grid-cols-[repeat(7,1fr)_52px] items-center gap-1 rounded-[8px] border px-1 py-1 text-left transition-all ${
                isSelected
                  ? "border-primary/50 bg-primary/6 shadow-[0_0_20px_-12px_var(--primary-glow)]"
                  : `border-transparent ${rowTone(week) || "hover:bg-surface-elevated/40"}`
              }`}
            >
              {row.map((iso) => {
                const d = parseIso(iso);
                const inMonth = d.getMonth() === cursorMonth;
                const isToday = iso === todayIso;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <span
                    key={iso}
                    className={`flex h-7 items-center justify-center rounded-[6px] text-[11px] ${
                      isToday
                        ? "bg-primary font-semibold text-white"
                        : !inMonth
                          ? "text-text-tertiary/40"
                          : isWeekend
                            ? "text-text-tertiary"
                            : "text-text-secondary"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                );
              })}
              <span className="text-right text-[10px] leading-3">
                {hasPlan ? (
                  <>
                    <b className={pct >= 100 ? "text-success" : "text-text"}>{pct}%</b>
                    <br />
                    <span className="text-text-tertiary">
                      {(week as WeekSummary).completedTasks}/{(week as WeekSummary).totalTasks}
                    </span>
                  </>
                ) : (
                  <span className="text-text-tertiary/50">—</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-text-tertiary">{footHint}</p>
    </div>
  );
}
