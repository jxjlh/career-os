"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RankingTile } from "@/components/life/social/ranking-tile";
import { Button, EmptyState, Skeleton } from "@/components/life/social/ui-extras";
import { apiFetch } from "@/lib/api";
import {
  RANKING_METRICS,
  RANKING_PERIODS,
  getRanking,
  type RankingMetric,
  type RankingPeriod,
} from "@/lib/social";

interface ProfileEnvelope {
  data: { id: string };
}

/**
 * 排行榜页: 多维度(XP/打卡/Bucket/目标/城市/国家/成就) × 时间(今日/本周/本月/全部).
 * 数字滚动动画 + 当前用户高亮.
 */
export default function RankingPage() {
  const [metric, setMetric] = useState<RankingMetric>("xp");
  const [period, setPeriod] = useState<RankingPeriod>("all");

  const profile = useQuery<ProfileEnvelope>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
  });
  const ranking = useQuery({
    queryKey: ["social-ranking", metric, period],
    queryFn: () => getRanking(metric, period),
  });

  const currentUserId = profile.data?.data?.id;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/life/social">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl">🏆</span>
        <div>
          <h1 className="text-xl font-semibold">排行榜</h1>
          <p className="text-[13px] text-muted">和好友一起, 看见彼此的成长</p>
        </div>
      </div>

      {/* 维度选择 */}
      <div className="flex flex-wrap gap-2">
        {RANKING_METRICS.map((m) => {
          const active = metric === m.metric;
          return (
            <button
              key={m.metric}
              type="button"
              onClick={() => setMetric(m.metric)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted hover:border-primary/40"
              }`}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 时间范围 */}
      <div className="flex gap-1 rounded-[10px] bg-surface-muted/60 p-1">
        {RANKING_PERIODS.map((p) => {
          const active = period === p.period;
          return (
            <button
              key={p.period}
              type="button"
              onClick={() => setPeriod(p.period)}
              className={`flex-1 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 排行榜列表 */}
      {ranking.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-[12px]" />
          ))}
        </div>
      ) : ranking.data && ranking.data.items.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {ranking.data.items.map((item) => (
              <motion.div key={item.user.id} layout>
                <RankingTile
                  item={item}
                  metric={metric}
                  isMe={item.user.id === currentUserId}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          title="暂无排行数据"
          description="完成目标、记录瞬间后, 排行榜就会点亮。"
        />
      )}
    </div>
  );
}
