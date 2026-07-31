"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, ListChecks, TrendingUp, Zap } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { CountUp } from "@/components/life/social/count-up";
import { getCheckinStreak, getLifeDashboard } from "@/lib/life";

/**
 * 成长趋势: 展示 XP / 等级 / 连续打卡 / Bucket 完成率.
 * 复用 LifeOS 仪表盘与打卡数据, 数字以 CountUp 动画呈现.
 */
export function CoachTrend() {
  const dashboard = useQuery({ queryKey: ["life-dashboard"], queryFn: getLifeDashboard });
  const streak = useQuery({ queryKey: ["life-checkin"], queryFn: getCheckinStreak });

  if (dashboard.isLoading || streak.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-[88px]" />
        <Skeleton className="h-[88px]" />
        <Skeleton className="h-[88px]" />
        <Skeleton className="h-[88px]" />
      </div>
    );
  }

  const level = dashboard.data?.level ?? 1;
  const xp = dashboard.data?.experience ?? 0;
  const rate = dashboard.data?.completionRate ?? 0;
  const streakDays = streak.data?.currentStreak ?? 0;

  const stats = [
    {
      label: "经验值",
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      node: <CountUp value={xp} />,
      unit: "XP",
    },
    {
      label: "等级",
      icon: <TrendingUp className="h-4 w-4 text-violet-500" />,
      node: <>Lv.<CountUp value={level} /></>,
      unit: "",
    },
    {
      label: "连续打卡",
      icon: <Flame className="h-4 w-4 text-orange-500" />,
      node: <CountUp value={streakDays} />,
      unit: "天",
    },
    {
      label: "目标完成率",
      icon: <ListChecks className="h-4 w-4 text-emerald-500" />,
      node: <CountUp value={rate} />,
      unit: "%",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s, idx) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.06 }}
          className="flex h-[88px] flex-col justify-between rounded-[12px] border border-border bg-surface p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted">{s.label}</span>
            {s.icon}
          </div>
          <div className="flex items-end gap-1">
            <span className="text-xl font-bold leading-none">{s.node}</span>
            {s.unit && <span className="text-[11px] text-muted">{s.unit}</span>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
