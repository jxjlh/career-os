"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { easeStandard } from "@/lib/motion";

type ProgressEnvelope = {
  data: {
    planId: string | null;
    title: string | null;
    weekStart: string;
    completionRate: number;
    completedTasks: number;
    totalTasks: number;
    completedMinutes: number;
    totalMinutes: number;
    todayTasks: number;
    todayDone: number;
    weeklyFocus: string | null;
  };
};

/**
 * WeeklyPlanProgress —— Dashboard 首页「本周进度」模块。
 *
 * 编辑部式杂志排版: 大数字完成率 + 7 天圆点 + 今日任务摘要.
 * 点击整体跳转 /planner 进入完整周计划.
 */
export function WeeklyPlanProgress() {
  const { t } = useI18n();
  const { data } = useQuery<ProgressEnvelope>({
    queryKey: ["planner-progress"],
    queryFn: () => apiFetch("/planner/progress"),
    staleTime: 30_000,
  });

  const progress = data?.data;
  const completionPct = Math.round((progress?.completionRate ?? 0) * 100);

  // count-up 动画
  const [displayedPct, setDisplayedPct] = useState(0);
  useEffect(() => {
    if (completionPct === displayedPct) return;
    const diff = completionPct - displayedPct;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 10)) * Math.sign(diff);
    const id = setInterval(() => {
      setDisplayedPct((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= completionPct) || (step < 0 && next <= completionPct)) {
          clearInterval(id);
          return completionPct;
        }
        return next;
      });
    }, 24);
    return () => clearInterval(id);
  }, [completionPct, displayedPct]);

  // 7 天圆点: 用 todayTasks 推不出每天的完成情况, 这里仅做视觉示意
  // (后端 progress 端点不返回每天细节, 这里用本周完成率映射)
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const dots = weekDays.map((_, i) => {
    if (!progress || progress.totalTasks === 0) return false;
    // 已过去的天: 按完成率推算
    if (i < todayIdx) return progress.completionRate >= 0.5;
    if (i === todayIdx) return progress.todayTasks > 0 && progress.todayDone === progress.todayTasks && progress.todayTasks > 0;
    return false;
  });

  // 无计划时显示极简空状态
  if (!progress || !progress.planId) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={easeStandard}
        className="mt-12"
      >
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {t("planner.thisWeekProgress")}
        </h2>
        <div className="mt-3 flex items-center justify-between rounded-[14px] border border-dashed border-border-subtle bg-surface/40 px-5 py-4">
          <div>
            <p className="text-[13px] text-text-secondary">{t("planner.noPlan")}</p>
            <p className="mt-0.5 text-[11px] text-text-tertiary">{t("planner.weeklyPlanProgressDesc")}</p>
          </div>
          <a
            href="/planner"
            className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-primary hover:text-primary-glow"
          >
            {t("planner.generateNow")} →
          </a>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeStandard}
      className="mt-12"
    >
      <a href="/planner" className="group block">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {t("planner.thisWeekProgress")}
        </h2>

        {/* 大数字完成率 + 今日任务 */}
        <div className="mt-3 flex items-end justify-between gap-6">
          <div className="flex items-baseline gap-2">
            <motion.span
              key={displayedPct}
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="font-display text-[56px] font-bold leading-none tracking-tight text-text"
            >
              {displayedPct}
              <span className="text-[28px] text-text-secondary">%</span>
            </motion.span>
          </div>

          <div className="flex flex-col items-end gap-1 pb-1.5">
            <span className="font-display text-[14px] font-semibold text-text">
              {progress.todayDone}/{progress.todayTasks}
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              {t("planner.todayTasks")}
            </span>
          </div>
        </div>

        {/* 7 天圆点 */}
        <div className="mt-4 flex items-center gap-3">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="font-display text-[10px] font-medium uppercase text-text-tertiary">{d}</span>
              <span
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  dots[i] ? "bg-primary-glow shadow-[0_0_8px_var(--primary-glow)]" : "bg-surface-elevated"
                }`}
              />
            </div>
          ))}
          {/* 右侧分钟数 */}
          <span className="ml-auto text-[11px] text-text-tertiary">
            {progress.completedMinutes}/{progress.totalMinutes} {t("planner.minutes")}
          </span>
        </div>

        {/* weeklyFocus 一句话寄语 */}
        {progress.weeklyFocus && (
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-text-secondary group-hover:text-text">
            {progress.weeklyFocus}
          </p>
        )}
      </a>
    </motion.section>
  );
}
