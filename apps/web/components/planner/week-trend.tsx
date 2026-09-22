"use client";

import { motion } from "framer-motion";

import { formatMD, type WeekSummary } from "@/lib/planner";
import { easeStandard } from "@/lib/motion";

/**
 * 近 N 周完成率趋势条 —— 周计划页顶端的历史可视化。
 * 每根柱子 = 一周，填充高度 = 完成率；点击切换查看该周。
 */
export function WeekTrend({
  weeks,
  selectedWeek,
  onSelect,
  title,
  emptyHint,
}: {
  weeks: WeekSummary[];
  selectedWeek: string;
  onSelect: (weekStart: string) => void;
  title: string;
  emptyHint: string;
}) {
  const withPlan = weeks.filter((w) => w.totalTasks > 0);
  const avgRate = withPlan.length
    ? withPlan.reduce((sum, w) => sum + w.completionRate, 0) / withPlan.length
    : 0;

  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/50 p-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-[12px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
            {title}
          </h3>
          <p className="mt-1 text-[11px] text-text-tertiary">
            {withPlan.length > 0
              ? `${withPlan.length} 周有计划 · 平均完成率 ${Math.round(avgRate * 100)}%`
              : emptyHint}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-3 rounded-sm bg-primary" />
            完成
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-3 rounded-sm bg-surface-elevated" />
            未完成
          </span>
        </div>
      </div>

      <div className="flex h-[104px] items-end gap-[3px]">
        {weeks.map((w) => {
          const hasPlan = w.totalTasks > 0;
          const rate = hasPlan ? Math.max(0, Math.min(1, w.completionRate)) : 0;
          const isSelected = w.weekStart === selectedWeek;
          const label = `${w.weekStart} ~ ${w.weekEnd}\n${
            hasPlan
              ? `完成 ${w.completedTasks}/${w.totalTasks} 个任务（${Math.round(rate * 100)}%）· ${w.completedMinutes}/${w.totalMinutes} 分钟`
              : "这一周没有计划"
          }`;
          return (
            <button
              key={w.weekStart}
              type="button"
              onClick={() => onSelect(w.weekStart)}
              title={label}
              aria-label={label}
              className={`group relative flex h-full flex-1 flex-col justify-end rounded-[6px] px-[2px] pb-[14px] pt-1 transition-colors ${
                isSelected ? "bg-primary/8 ring-1 ring-primary/40" : "hover:bg-surface-elevated/50"
              }`}
            >
              <div
                className={`relative flex h-[70px] w-full items-end overflow-hidden rounded-[4px] ${
                  hasPlan
                    ? "bg-surface-elevated ring-1 ring-inset ring-primary/20"
                    : "bg-surface-elevated/25"
                }`}
              >
                {hasPlan ? (
                  <>
                    {/* 0% 的周也给一条细底边, 表示「这周有计划但一个都没完成」 */}
                    <div className="absolute inset-x-0 bottom-0 h-[3px] bg-primary/30" />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${rate * 100}%` }}
                      transition={easeStandard}
                      className={`relative w-full rounded-t-[3px] ${
                        rate >= 0.999
                          ? "bg-gradient-to-t from-primary to-primary-glow"
                          : "bg-primary/70"
                      }`}
                    />
                  </>
                ) : null}
                {w.isCurrent && (
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-accent" title="本周" />
                )}
              </div>
              <span
                className={`absolute bottom-0 left-0 right-0 text-center text-[9px] leading-3 ${
                  isSelected ? "font-semibold text-primary" : "text-text-tertiary"
                }`}
              >
                {formatMD(w.weekStart)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
