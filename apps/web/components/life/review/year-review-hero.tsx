"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";

import { CountUp } from "./count-up";
import type { YearReviewResponse } from "@/lib/life";

/**
 * 年度报告 Hero: 年份 + 标题 + 摘要 + XP, 渐变毛玻璃背景, fade + scale 进入动画.
 * 副标题由 statistics 动态拼接: "这一年我完成了 X 个目标, 记录 Y 次人生瞬间, 成长很多."
 */
export function YearReviewHero({ review }: { review: YearReviewResponse }) {
  const stats = review.statistics || {};
  const goals = stats.goalsCompleted ?? stats.goals_completed ?? 0;
  const records = stats.recordsCreated ?? stats.records_created ?? 0;
  const xp = stats.xpGained ?? stats.xp_gained ?? 0;

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[16px] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      {/* 渐变底层 */}
      <div className="absolute inset-0 bg-gradient-to-br from-ai/30 via-primary/20 to-emerald-400/15" />
      {/* 毛玻璃层: 模糊其后的渐变, 叠加半透明白色形成玻璃质感 */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-md" />
      {/* 装饰光斑 */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-ai/20 blur-3xl" />
      <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.25em] text-muted">
            <Sparkles className="h-3.5 w-3.5 text-ai" />
            Year Review
          </p>
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300"
          >
            <Zap className="h-3.5 w-3.5" />
            <CountUp value={xp} /> XP
          </motion.span>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-4 text-4xl font-bold leading-none sm:text-5xl"
        >
          {review.year}
        </motion.h1>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-2 text-lg font-semibold sm:text-xl"
        >
          {review.title || "我的人生报告"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-3 text-sm leading-relaxed text-text/80"
        >
          这一年，我完成了{" "}
          <span className="font-semibold text-primary">
            <CountUp value={goals} /> 个目标
          </span>
          ，记录{" "}
          <span className="font-semibold text-primary">
            <CountUp value={records} /> 次人生瞬间
          </span>
          ，成长很多。
        </motion.p>

        {review.summary && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-4 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-text/70"
          >
            {review.summary}
          </motion.p>
        )}
      </div>
    </motion.section>
  );
}
