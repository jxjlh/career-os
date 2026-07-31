"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { getCheckinStreak, triggerCheckin } from "@/lib/life";

/**
 * 连续打卡卡片: 展示 🔥 当前连续天数 + 今日是否已完成.
 * 今日未完成时点击可触发打卡 (通常由记录自动触发, 这里保留手动入口).
 */
export function CheckinStreakCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["life-checkin"],
    queryFn: getCheckinStreak,
  });

  const checkin = useMutation({
    mutationFn: triggerCheckin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[88px] rounded-[12px]" />;
  }
  if (!data) return null;

  const done = data.checkedInToday;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => !done && checkin.mutate()}
      disabled={done || checkin.isPending}
      className={`flex w-full items-center justify-between rounded-[12px] border p-4 text-left transition-colors ${
        done
          ? "border-success/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5"
          : "border-border bg-surface hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-3">
        <motion.span
          animate={done ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.6, repeat: done ? Infinity : 0, repeatDelay: 2 }}
          className="text-2xl"
        >
          🔥
        </motion.span>
        <div>
          <p className="text-sm font-semibold">
            连续打卡 {data.currentStreak} 天
          </p>
          <p className="text-xs text-muted">
            {done ? "今日已记录 ✨" : "今日还未记录, 去拍一张?"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="flex items-center justify-end gap-1 text-xs text-muted">
          <Flame className="h-3 w-3" />
          最长 {data.longestStreak} 天
        </p>
        <p className="mt-0.5 text-xs text-muted">累计 {data.totalCheckins} 次</p>
      </div>
    </motion.button>
  );
}
