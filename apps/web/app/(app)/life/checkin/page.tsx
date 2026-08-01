"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Flame, Trophy } from "lucide-react";
import Link from "next/link";

import { CheckinStreakCard } from "@/components/life/checkin-streak-card";
import { Button, Skeleton } from "@/components/ui";
import { getCheckinStreak } from "@/lib/life";

export default function CheckinPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["life-checkin"],
    queryFn: getCheckinStreak,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-orange-500" />
          连续打卡
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-[88px] rounded-[12px]" />
          <Skeleton className="h-32 rounded-[12px]" />
        </div>
      ) : (
        <>
          {/* 主打卡卡片 */}
          <CheckinStreakCard />

          {/* 统计概览 */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              icon={<Flame className="h-4 w-4 text-orange-500" />}
              value={data.currentStreak}
              label="当前连续"
              unit="天"
            />
            <StatTile
              icon={<Trophy className="h-4 w-4 text-amber-500" />}
              value={data.longestStreak}
              label="最长记录"
              unit="天"
            />
            <StatTile
              icon={<Calendar className="h-4 w-4 text-primary" />}
              value={data.totalCheckins}
              label="累计打卡"
              unit="次"
            />
          </div>

          {/* 鼓励文案 */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[12px] border border-border bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-5 text-center"
          >
            <p className="text-2xl">🔥</p>
            <p className="mt-1 text-sm font-semibold">
              {data.checkedInToday
                ? `已连续 ${data.currentStreak} 天, 继续保持!`
                : data.currentStreak === 0
                  ? "从今天开始你的打卡之旅"
                  : `昨日已断, 今天重新开始`}
            </p>
            <p className="mt-1 text-xs text-muted">
              每一次记录都会自动打卡, 坚持是成长的开始。
            </p>
          </motion.div>

          {/* 上次打卡时间 */}
          {data.lastCheckinDate && (
            <p className="text-center text-xs text-muted">
              上次打卡: {data.lastCheckinDate}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  unit,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  unit: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-1 rounded-[10px] border border-border bg-surface p-4"
    >
      {icon}
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs text-muted">
        {label} ({unit})
      </span>
    </motion.div>
  );
}
