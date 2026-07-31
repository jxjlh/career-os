"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Skeleton, cn } from "@/components/ui";
import { ReminderList } from "@/components/life/coach/reminder-list";
import {
  getCoachAdvice,
  PRIORITY_LABELS,
  type AdvicePriority,
} from "@/lib/coach";

const PRIORITY_BADGE: Record<AdvicePriority, "danger" | "warning" | "default"> = {
  high: "danger",
  medium: "warning",
  low: "default",
};

/**
 * Life AI Coach 首页 Hero.
 * 聚合今日建议 (greeting / advice / reminders / motivation), 由 AI 基于
 * Life Goal / Bucket / Task / Record / Map / Social 全量数据生成.
 * source=fallback 时仍可展示规则引擎建议, 保证离线可用.
 */
export function CoachHero() {
  const advice = useQuery({
    queryKey: ["coach-advice"],
    queryFn: getCoachAdvice,
  });

  if (advice.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 rounded-[16px]" />
        <Skeleton className="h-20 rounded-[12px]" />
      </div>
    );
  }

  const data = advice.data;

  return (
    <div className="space-y-4">
      {/* 问候 Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-pink-500/10 p-6"
      >
        <div className="absolute right-4 top-4 text-violet-500/20">
          <Sparkles className="h-20 w-20" />
        </div>
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-medium uppercase tracking-wide text-violet-600">
              Life AI Coach
            </span>
            {data?.source === "fallback" && (
              <Badge variant="default" className="bg-surface-muted text-muted">
                离线建议
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-semibold text-text">
            {data?.greeting || "今天也要好好成长 ✨"}
          </h1>
          {data?.motivation && (
            <p className="mt-1 text-[13px] text-muted">{data.motivation}</p>
          )}
          <p className="mt-2 text-[11px] text-muted">
            {data?.date || new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </motion.div>

      {/* 今日提醒 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">今日提醒</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => advice.refetch()}
            disabled={advice.isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", advice.isFetching && "animate-spin")} />
            刷新
          </Button>
        </div>
        <ReminderList reminders={data?.reminders ?? []} />
      </section>

      {/* 今日行动建议 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">今日行动建议</h2>
        {(data?.advice ?? []).length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
            暂无建议, 先补充人生目标或记录吧。
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.advice ?? []).map((item, idx) => (
              <motion.div
                key={`${item.title}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                className="rounded-[12px] border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant={PRIORITY_BADGE[item.priority]}>
                        {PRIORITY_LABELS[item.priority]}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-[13px] text-muted">{item.description}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* 进入对话 */}
      <Link href="/life/coach/chat">
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex items-center justify-between rounded-[14px] border border-border bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium">和教练聊聊</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted" />
        </motion.div>
      </Link>
    </div>
  );
}
