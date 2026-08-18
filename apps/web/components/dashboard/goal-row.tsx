"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { cn } from "@/components/ui";

export interface GoalRowProps {
  index: number;
  title: string;
  progress: number; // 0-100
  category?: string;
  href?: string;
}

/**
 * 单行 Goal —— 极轻量 Row，不是巨大 Card。
 * 序号 01 + 标题 + 百分比 + 进度条（width 动画 250ms ease-out）。
 * 使用 Next.js Link 实现客户端导航，避免整页刷新触发 AuthGuard 重定向。
 */
export function GoalRow({ index, title, progress, href = "#" }: GoalRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 py-3 transition-colors hover:bg-surface-elevated/30"
    >
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut", delay: index * 0.04 }}
        className="flex flex-1 items-center gap-4"
      >
        {/* 序号 —— editorial 数字 */}
        <span className="font-display w-8 shrink-0 text-[13px] font-medium tabular-nums text-text-tertiary">
          {String(index).padStart(2, "0")}
        </span>

        {/* 标题 */}
        <span className="min-w-0 flex-1 truncate text-[14px] text-text transition-colors group-hover:text-primary-glow">
          {title}
        </span>

        {/* 百分比 */}
        <span
          className={cn(
            "font-display shrink-0 text-[13px] font-semibold tabular-nums",
            progress >= 100 ? "text-success" : "text-text-secondary",
          )}
        >
          {progress}%
        </span>

        {/* 进度条 —— 极细，width 动画 */}
        <div className="hidden h-[3px] w-32 overflow-hidden rounded-full bg-surface-elevated sm:block">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + index * 0.04 }}
            className={cn(
              "h-full rounded-full",
              progress >= 100
                ? "bg-gradient-to-r from-success to-info"
                : "bg-gradient-to-r from-primary to-primary-glow",
            )}
          />
        </div>
      </motion.div>
    </Link>
  );
}
