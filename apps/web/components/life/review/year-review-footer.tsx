"use client";

import { motion } from "framer-motion";
import { ArrowDown, Flag, NotebookPen } from "lucide-react";

/**
 * 报告收尾: 年度反思 → 下一年计划 → 结束语 "新的旅程, 已经开始."
 * 段落之间用向下的连接动画串联, 形成阅读节奏.
 */
export function YearReviewFooter({
  reflection,
  nextYearPlan,
}: {
  reflection?: string | null;
  nextYearPlan: string[];
}) {
  const hasReflection = Boolean(reflection);
  const hasPlan = nextYearPlan && nextYearPlan.length > 0;

  if (!hasReflection && !hasPlan) {
    return (
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-8 text-center"
      >
        <p className="bg-gradient-to-r from-ai via-primary to-emerald-500 bg-clip-text text-lg font-semibold text-transparent">
          新的旅程，已经开始。
        </p>
      </motion.section>
    );
  }

  return (
    <section className="space-y-3">
      {hasReflection && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="rounded-[12px] border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="h-4 w-4 text-primary" />
            年度反思
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text/80">{reflection}</p>
        </motion.div>
      )}

      {hasReflection && hasPlan && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="flex justify-center"
        >
          <motion.span
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="text-muted"
          >
            <ArrowDown className="h-4 w-4" />
          </motion.span>
        </motion.div>
      )}

      {hasPlan && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="rounded-[12px] border border-border bg-surface p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flag className="h-4 w-4 text-primary" />
            下一年计划
          </div>
          <ul className="mt-3 space-y-2">
            {nextYearPlan.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-[13px] text-text/80">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="pt-4 text-center text-lg font-semibold"
      >
        <span className="bg-gradient-to-r from-ai via-primary to-emerald-500 bg-clip-text text-transparent">
          新的旅程，已经开始。
        </span>
      </motion.p>
    </section>
  );
}
