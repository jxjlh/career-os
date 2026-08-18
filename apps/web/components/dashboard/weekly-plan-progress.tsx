"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
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
    planCompletionRate: number;
    completedTasks: number;
    totalTasks: number;
    completedMinutes: number;
    totalMinutes: number;
    todayTasks: number;
    todayDone: number;
    weeklyFocus: string | null;
    // 人生目标
    goals: {
      id: string;
      title: string;
      category: string;
      status: string;
      tasksDone: number;
      tasksTotal: number;
      progress: number;
    }[];
    goalsCompleted: number;
    goalsTotal: number;
    goalsActive: number;
    // 学习统计
    wordsLearnedThisWeek: number;
    studyMinutesThisWeek: number;
    totalMasteredWords: number;
  };
};

/**
 * WeeklyPlanProgress —— Dashboard 首页「本周进度」模块。
 * 整合: 周计划任务 + 人生目标 + 英语学习
 */
export function WeeklyPlanProgress() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data } = useQuery<ProgressEnvelope>({
    queryKey: ["planner-progress"],
    queryFn: () => apiFetch("/planner/progress"),
    staleTime: 10_000,
  });

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      await apiFetch("/planner/generate", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["planner-progress"] });
    } catch (err: any) {
      setGenError(err?.message || "生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  };

  const progress = data?.data;
  const completionPct = Math.round((progress?.completionRate ?? 0) * 100);

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

  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const dots = weekDays.map((_, i) => {
    if (!progress || progress.totalTasks === 0) return false;
    if (i < todayIdx) return progress.completionRate >= 0.5;
    if (i === todayIdx) return progress.todayTasks > 0 && progress.todayDone === progress.todayTasks && progress.todayTasks > 0;
    return false;
  });

  // 无计划且无数据时显示生成按钮
  if (!progress || (!progress.planId && progress.goalsActive === 0 && progress.wordsLearnedThisWeek === 0)) {
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
            {genError && <p className="mt-1 text-[11px] text-danger">{genError}</p>}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:text-primary-glow disabled:opacity-50"
          >
            {generating ? "生成中..." : "立即生成 →"}
          </button>
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
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {t("planner.thisWeekProgress")}
      </h2>

      {/* 综合进度数字 */}
      <div className="mt-3 flex items-end justify-between gap-6">
        <a href="/planner" className="group flex items-baseline gap-2">
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
          <span className="pb-2 text-[11px] text-text-tertiary">综合进度</span>
        </a>

        <div className="flex flex-col items-end gap-1 pb-1.5">
          <span className="font-display text-[14px] font-semibold text-text">
            {progress.todayDone}/{progress.todayTasks}
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
            {t("planner.todayTasks")}
          </span>
        </div>
      </div>

      {/* 周计划进度条 */}
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
        <span className="ml-auto text-[11px] text-text-tertiary">
          {progress.completedMinutes}/{progress.totalMinutes} {t("planner.minutes")}
        </span>
      </div>

      {/* 三板块整合 */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {/* 周计划 */}
        <a
          href="/planner"
          className="group rounded-xl border border-white/5 bg-surface/30 p-3 transition-colors hover:bg-surface-elevated/40"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📋</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">周计划</span>
          </div>
          <p className="mt-1.5 font-display text-[18px] font-bold text-text">
            {progress.completedTasks}<span className="text-[12px] text-text-tertiary">/{progress.totalTasks}</span>
          </p>
          <p className="text-[10px] text-text-tertiary">任务完成</p>
        </a>

        {/* 人生目标 */}
        <a
          href="/life"
          className="group rounded-xl border border-white/5 bg-surface/30 p-3 transition-colors hover:bg-surface-elevated/40"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🎯</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">人生目标</span>
          </div>
          <p className="mt-1.5 font-display text-[18px] font-bold text-text">
            {progress.goalsActive}<span className="text-[12px] text-text-tertiary"> 进行中</span>
          </p>
          <p className="text-[10px] text-text-tertiary">已完成 {progress.goalsCompleted}</p>
        </a>

        {/* 英语学习 */}
        <a
          href="/english"
          className="group rounded-xl border border-white/5 bg-surface/30 p-3 transition-colors hover:bg-surface-elevated/40"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📚</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">学习</span>
          </div>
          <p className="mt-1.5 font-display text-[18px] font-bold text-text">
            {progress.wordsLearnedThisWeek}<span className="text-[12px] text-text-tertiary"> 词/周</span>
          </p>
          <p className="text-[10px] text-text-tertiary">已掌握 {progress.totalMasteredWords}</p>
        </a>
      </div>

      {/* 人生目标进度列表 */}
      {progress.goals && progress.goals.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {progress.goals.slice(0, 3).map((goal) => (
            <Link
              key={goal.id}
              href={`/life/goals/detail?id=${goal.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-elevated/30"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary group-hover:text-text">
                {goal.title}
              </span>
              <div className="h-[3px] w-16 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <span className="font-display text-[11px] tabular-nums text-text-tertiary">
                {Math.round(goal.progress)}%
              </span>
            </Link>
          ))}
        </div>
      )}

      {progress.weeklyFocus && (
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-text-secondary">
          {progress.weeklyFocus}
        </p>
      )}
    </motion.section>
  );
}
