"use client";

import { motion } from "framer-motion";
import { Flame, Sparkles, Trophy } from "lucide-react";

import type { BucketProgress } from "@/lib/bucket";

export function BucketHero({ progress }: { progress: BucketProgress }) {
  const completionRate =
    progress.aspirationalTotal > 0
      ? Math.min(100, Math.round((progress.completedCount / progress.aspirationalTotal) * 1000) / 10)
      : 0;
  const joinedRate =
    progress.totalCatalog > 0
      ? Math.round((progress.completedCount / progress.totalCatalog) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[20px] border border-white/10 p-6 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, #6366F1 0%, #8B5CF6 45%, #EC4899 100%)",
      }}
    >
      {/* 背景光斑 */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-pink-300/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wider opacity-90">
            LifeOS · Bucket List
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">人生必做清单</h1>
        <p className="mt-1.5 text-sm opacity-80">把想做的事变成做过的事，让人生值得回味。</p>

        {/* 进度核心 */}
        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="flex items-baseline gap-1">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-bold tracking-tight sm:text-5xl"
              >
                {progress.completedCount}
              </motion.span>
              <span className="text-lg opacity-60">/ {progress.aspirationalTotal}</span>
            </div>
            <p className="mt-1 text-xs opacity-75">已完成 · 人生完成度 {completionRate}%</p>
          </div>

          <div className="flex gap-5">
            <Stat icon={<Trophy className="h-4 w-4" />} label="等级" value={`Lv.${progress.level}`} />
            <Stat icon={<Flame className="h-4 w-4" />} label="连续打卡" value={`${progress.streak} 天`} />
            <Stat label="XP" value={String(progress.experience)} />
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-[11px] opacity-80">
            <span>目录完成度</span>
            <span>{joinedRate}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${joinedRate}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
              className="h-full rounded-full bg-white/90"
            />
          </div>
          <p className="mt-2 text-[11px] opacity-70">
            已加入 {progress.joinedCount} · 目录共 {progress.totalCatalog} 项
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 text-[11px] opacity-70">{icon}{label}</span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
