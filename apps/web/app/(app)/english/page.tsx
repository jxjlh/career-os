"use client";

import { BookOpen, Headphones, BarChart3, Flame, Target, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, type TodayStats } from "@/lib/english";

export default function EnglishPage() {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([englishApi.getTodayStats(), englishApi.getStreak()])
      .then(([todayRes, streakRes]) => {
        setStats(todayRes.data);
        setStreak(streakRes.data.streak);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">英语学习</h1>
        <p className="mt-1 text-sm text-muted">从 CET-4 到托福，科学记单词、练听力</p>
      </div>

      {/* 今日统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Target className="h-4 w-4" />} label="今日新学" value={stats?.newWords ?? 0} loading={loading} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="今日复习" value={stats?.reviewWords ?? 0} loading={loading} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="连续打卡" value={streak} suffix="天" loading={loading} />
        <StatCard icon={<Headphones className="h-4 w-4" />} label="听力练习" value={stats?.listeningCount ?? 0} loading={loading} />
      </div>

      {/* 功能入口 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/english/words">
          <Card className="cursor-pointer p-5 transition-colors hover:bg-surface-elevated">
            <BookOpen className="h-8 w-8 text-primary" />
            <h3 className="mt-3 font-semibold">单词学习</h3>
            <p className="mt-1 text-xs text-muted">词书选择、卡片学习、间隔复习</p>
          </Card>
        </Link>
        <Link href="/english/listening">
          <Card className="cursor-pointer p-5 transition-colors hover:bg-surface-elevated">
            <Headphones className="h-8 w-8 text-accent" />
            <h3 className="mt-3 font-semibold">听力练习</h3>
            <p className="mt-1 text-xs text-muted">AI 生成材料、TTS 朗读、答题</p>
          </Card>
        </Link>
        <Link href="/english/stats">
          <Card className="cursor-pointer p-5 transition-colors hover:bg-surface-elevated">
            <BarChart3 className="h-8 w-8 text-success" />
            <h3 className="mt-3 font-semibold">学习统计</h3>
            <p className="mt-1 text-xs text-muted">打卡日历、学习进度</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-text-tertiary">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">
        {loading ? "—" : value}
        {suffix && !loading && <span className="ml-0.5 text-xs font-normal text-muted">{suffix}</span>}
      </p>
    </Card>
  );
}
