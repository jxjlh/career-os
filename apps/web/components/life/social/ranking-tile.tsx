"use client";

import { motion } from "framer-motion";
import { Crown } from "lucide-react";

import { Avatar, Chip, cn } from "@/components/life/social/ui-extras";
import { CountUp } from "@/components/life/social/count-up";
import { RANKING_METRICS, type RankingItem, type RankingMetric } from "@/lib/social";

interface RankingTileProps {
  item: RankingItem;
  metric: RankingMetric;
  isMe?: boolean;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/**
 * 排行榜单行: 名次 + 头像 + 用户名 + 数值(CountUp 滚动动画).
 * 前三名使用奖牌, 当前用户高亮.
 */
export function RankingTile({ item, metric, isMe = false }: RankingTileProps) {
  const meta = RANKING_METRICS.find((m) => m.metric === metric);
  const rank = item.rank;
  const showMedal = rank <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min((rank - 1) * 0.04, 0.4) }}
      className={cn(
        "flex items-center gap-3 rounded-[12px] border p-3",
        isMe
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface hover:border-border/80",
      )}
    >
      <div className="flex w-8 shrink-0 items-center justify-center">
        {showMedal ? (
          <span className="text-xl">{MEDAL[rank - 1]}</span>
        ) : (
          <span className="text-sm font-bold tabular-nums text-muted">#{rank}</span>
        )}
      </div>

      <Avatar name={item.user.displayName} avatarUrl={item.user.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{item.user.displayName}</p>
          {isMe && (
            <Chip className="shrink-0 bg-primary/10 text-primary">
              <Crown className="h-3 w-3" />
              我
            </Chip>
          )}
        </div>
        <p className="truncate text-xs text-muted">
          {item.user.currentTitle || "探索者"}
        </p>
      </div>

      <div className="text-right">
        <span className="text-lg font-bold tabular-nums">
          <CountUp value={item.value} />
        </span>
        {meta && <span className="ml-1 text-xs text-muted">{meta.unit}</span>}
      </div>
    </motion.div>
  );
}
