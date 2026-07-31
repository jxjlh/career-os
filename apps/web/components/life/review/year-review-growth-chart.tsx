"use client";

import { motion } from "framer-motion";

import { CountUp } from "./count-up";
import { getLevelInfo, type YearReviewStatistics } from "@/lib/life";

const STAT_ITEMS = [
  { icon: "🎯", label: "完成目标", field: "goals" as const, color: "from-sky-400/15 to-blue-500/10" },
  { icon: "✅", label: "完成任务", field: "tasks" as const, color: "from-emerald-400/15 to-teal-500/10" },
  { icon: "📷", label: "人生记录", field: "records" as const, color: "from-fuchsia-400/15 to-purple-500/10" },
  { icon: "⚡", label: "获得 XP", field: "xp" as const, color: "from-amber-400/15 to-orange-500/10" },
];

function statValue(statistics: YearReviewStatistics, field: "goals" | "tasks" | "records" | "xp"): number {
  switch (field) {
    case "goals":
      return statistics.goalsCompleted ?? statistics.goals_completed ?? 0;
    case "tasks":
      return statistics.tasksCompleted ?? statistics.tasks_completed ?? 0;
    case "records":
      return statistics.recordsCreated ?? statistics.records_created ?? 0;
    case "xp":
      return statistics.xpGained ?? statistics.xp_gained ?? 0;
  }
}

/**
 * 成长数据可视化: 四张统计卡 (Count Up 数字动画) + XP 进度环 (SVG, 由年度 XP 派生等级与进度).
 */
export function YearReviewGrowthChart({ statistics }: { statistics: YearReviewStatistics }) {
  const xp = statValue(statistics, "xp");
  // 仅 UI 派生: 用年度 XP 推算"年度成长等级", 复用全局等级公式, 不调用任何后端.
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const { progressPercent, remaining } = getLevelInfo(level, xp);

  const RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <section className="space-y-3">
      <motion.h3
        initial={{ opacity: 0, x: -8 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4 }}
        className="text-sm font-semibold text-muted"
      >
        成长数据
      </motion.h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ITEMS.map((item, index) => (
          <motion.div
            key={item.field}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className={`rounded-[12px] border border-border bg-gradient-to-br ${item.color} p-4`}
          >
            <span className="text-xl">{item.icon}</span>
            <p className="mt-2 text-2xl font-bold leading-none">
              <CountUp value={statValue(statistics, item.field)} />
            </p>
            <p className="mt-1.5 text-xs text-muted">{item.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-5 rounded-[12px] border border-border bg-surface p-5"
      >
        <div className="relative h-32 w-32 flex-none">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="10" />
            <motion.circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              whileInView={{ strokeDashoffset: CIRCUMFERENCE * (1 - progressPercent / 100) }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted">Level</span>
            <span className="text-2xl font-bold leading-none">{level}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">年度成长等级</p>
          <p className="mt-1 text-[13px] text-muted">
            进度 <span className="font-semibold text-primary">{progressPercent}%</span> · 距下一级还差 {remaining} XP
          </p>
          <p className="mt-2 text-xs text-muted">由本年度获得 XP 推算, 仅供可视化参考.</p>
        </div>
      </motion.div>
    </section>
  );
}
