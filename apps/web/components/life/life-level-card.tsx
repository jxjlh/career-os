"use client";

import { motion } from "framer-motion";

export function LifeLevelCard({
  level,
  experience,
  progressPercent,
  remaining,
}: {
  level: number;
  experience: number;
  progressPercent: number;
  remaining: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-[12px] border border-border bg-gradient-to-br from-blue-500/10 to-emerald-500/10 p-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] text-muted">人生等级</p>
          <p className="text-3xl font-bold">Lv.{level}</p>
        </div>
        <p className="text-sm font-medium text-primary">{experience} XP</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">距离下一等级还有 {remaining} XP</p>
    </motion.div>
  );
}
