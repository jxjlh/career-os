"use client";

import { motion } from "framer-motion";

import { getCategoryMeta } from "@/lib/life";

export function LifeCategoryCard({
  category,
  total,
  completed,
}: {
  category: string;
  total: number;
  completed: number;
}) {
  const meta = getCategoryMeta(category);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[12px] border border-border bg-gradient-to-br ${meta.gradient} p-4`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xl">{meta.icon}</span>
        <span className="text-[13px] font-medium">{percent}%</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{meta.labelZh}</p>
      <p className="text-xs text-muted">
        {completed} / {total} 个目标
      </p>
    </motion.div>
  );
}
