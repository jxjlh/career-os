"use client";

import { motion } from "framer-motion";
import { Award, BookOpen, CalendarCheck, RefreshCw, Share2, Trophy } from "lucide-react";
import { useState } from "react";

import { Button, Card } from "@/components/ui";
import type { YearReviewResponse } from "@/lib/life";

const VERSION_TABS = [
  { key: "normal", label: "完整版" },
  { key: "moments", label: "朋友圈" },
  { key: "xiaohongshu", label: "小红书" },
] as const;

type VersionKey = (typeof VERSION_TABS)[number]["key"];

export function YearReviewView({
  review,
  onRegenerate,
}: {
  review: YearReviewResponse;
  onRegenerate: () => void;
}) {
  const [tab, setTab] = useState<VersionKey>("normal");
  const growth = review.growth || {};
  const content = review.versions?.[tab] || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{review.year} 年度回顾</p>
            <h1 className="mt-1 text-2xl font-bold">{review.title || `${review.year}年度人生总结`}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <RefreshCw className="h-3.5 w-3.5" />
            重新生成
          </Button>
        </div>
        {review.summary && <p className="mt-3 text-sm leading-relaxed text-text/80">{review.summary}</p>}
        {review.highlights.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {review.highlights.map((item, index) => (
              <p key={index} className="flex items-start gap-2 rounded-[8px] bg-surface-muted px-3 py-2 text-[13px]">
                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                {item}
              </p>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GrowthStat icon={<CalendarCheck className="h-4 w-4" />} label="完成目标" value={growth.goals_completed ?? 0} />
          <GrowthStat icon={<BookOpen className="h-4 w-4" />} label="人生记录" value={growth.records ?? 0} />
          <GrowthStat icon={<Award className="h-4 w-4" />} label="经验值" value={growth.xp_gained ?? 0} />
          <GrowthStat icon={<Trophy className="h-4 w-4" />} label="等级" value={growth.level ?? 1} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Share2 className="h-4 w-4 text-primary" />
            分享版本
          </p>
          <div className="flex rounded-full bg-surface-muted p-0.5">
            {VERSION_TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tab === item.key ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {content ? (
          <p className="mt-3 whitespace-pre-wrap rounded-[10px] bg-surface-muted/60 p-4 text-sm leading-relaxed text-text/80">
            {content}
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-muted">该版本暂未生成。</p>
        )}
      </Card>
    </motion.div>
  );
}

function GrowthStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
