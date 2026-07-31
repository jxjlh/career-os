"use client";

import { motion } from "framer-motion";

import { CATEGORY_META, type LifeGoal } from "@/lib/life";

export function RecentCompletedCard({ items }: { items: LifeGoal[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-[12px] border border-border bg-surface p-4"
    >
      <p className="mb-3 text-[13px] text-muted">最近完成</p>
      {items.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted">完成人生目标后，会显示在这里。</p>
      ) : (
        <div className="space-y-2">
          {items.map((goal) => {
            const meta = CATEGORY_META[goal.category] || CATEGORY_META.other;
            return (
              <div key={goal.id} className="flex items-center gap-3 rounded-[10px] border border-border p-2.5">
                {goal.coverImage ? (
                  <img src={goal.coverImage} alt={goal.title} className="h-10 w-10 rounded-[8px] object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-surface-muted text-lg">
                    {meta.icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{goal.title}</p>
                  <p className="text-xs text-muted">
                    {goal.targetDate || goal.createdAt?.slice(0, 10) || ""}
                    {goal.location ? ` · ${goal.location}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
