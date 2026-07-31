"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Share2, Target, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Avatar, Skeleton } from "@/components/life/social/ui-extras";
import { CountUp } from "@/components/life/social/count-up";
import { getSocialOverview } from "@/lib/social";

/**
 * 社交概览卡: 用于人生首页顶部.
 * 今日成长 / 连续打卡 / 共同目标 / 好友完成情况.
 */
export function SocialOverviewCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["social-overview"],
    queryFn: getSocialOverview,
  });

  if (isLoading) {
    return <Skeleton className="h-[120px] rounded-[14px]" />;
  }
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-[14px] border border-border bg-gradient-to-br from-indigo-500/5 to-pink-500/5"
    >
      <div className="grid grid-cols-3 divide-x divide-border/60">
        <Stat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="今日成长"
          value={<CountUp value={data.todayGrowth} />}
        />
        <Stat
          icon={<Flame className="h-3.5 w-3.5" />}
          label="连续打卡"
          value={<><CountUp value={data.checkinStreak} /> 天</>}
        />
        <Stat
          icon={<Share2 className="h-3.5 w-3.5" />}
          label="共同目标"
          value={<CountUp value={data.sharedGoalsCount} />}
        />
      </div>

      {data.friendsRecentCompletions.length > 0 && (
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Target className="h-3 w-3" />
              好友完成情况
            </p>
            <Link
              href="/life/social"
              className="flex items-center gap-0.5 text-xs text-primary hover:opacity-80"
            >
              全部动态 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {data.friendsRecentCompletions.slice(0, 3).map((c, i) => (
              <motion.div
                key={`${c.userId}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-2"
              >
                <Avatar name={c.displayName} avatarUrl={c.avatarUrl} size={24} />
                <p className="min-w-0 flex-1 truncate text-xs">
                  <span className="font-medium">{c.displayName}</span>
                  <span className="text-muted"> 完成了 </span>
                  <span className="font-medium">{c.title}</span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="mb-1 flex items-center justify-center gap-1 text-muted">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
