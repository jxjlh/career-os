"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { cn } from "@/components/ui";

export interface GoalRowProps {
  index: number;
  title: string;
  progress: number;
  category?: string;
  href?: string;
}

export function GoalRow({ index, title, progress, href = "#" }: GoalRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: index * 0.04 }}
    >
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-[10px] py-3 transition-colors hover:bg-surface-elevated"
      >
        <span className="font-display w-8 shrink-0 text-[13px] font-medium tabular-nums text-text-tertiary">
          {String(index).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1 truncate text-[14px] text-text-secondary transition-colors group-hover:text-primary">
          {title}
        </span>

        <span
          className={cn(
            "font-display shrink-0 text-[13px] font-semibold tabular-nums",
            progress >= 100 ? "text-success" : "text-text-secondary",
          )}
        >
          {progress}%
        </span>

        <div className="hidden h-[3px] w-32 overflow-hidden rounded-full bg-surface-muted sm:block">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + index * 0.04 }}
            className={cn(
              "h-full rounded-full",
              progress >= 100 ? "bg-success" : "bg-primary",
            )}
          />
        </div>
      </Link>
    </motion.div>
  );
}
