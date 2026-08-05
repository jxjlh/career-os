"use client";

import { BarChart3, Flame, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui";
import { englishApi, type StreakStats, type TodayStats } from "@/lib/english";

export default function EnglishStatsPage() {
  const [today, setToday] = useState<TodayStats | null>(null);
  const [streak, setStreak] = useState<StreakStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([englishApi.getTodayStats(), englishApi.getStreak()])
      .then(([t, s]) => {
        setToday(t.data);
        setStreak(s.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 生成过去 30 天日历数据
  const calendar = streak?.calendar ?? [];
  const calendarMap = new Map(calendar.map((c) => [c.date, c] as [string, typeof c]));

  const todayDate = new Date();
  const days: { date: Date; key: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const data = calendarMap.get(key);
    days.push({ date: d, key, total: data?.total ?? 0 });
  }

  const maxTotal = Math.max(1, ...days.map((d) => d.total));

  const stats = today ?? {
    newWords: 0,
    reviewWords: 0,
    masteredWords: 0,
    listeningCount: 0,
    listeningCorrect: 0,
    durationMinutes: 0,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">学习统计</h1>
        <p className="mt-1 text-sm text-muted">追踪你的英语学习节奏和进步</p>
      </div>

      {/* 顶部 4 卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat
          icon={<Flame className="h-4 w-4" />}
          label="连续打卡"
          value={streak?.streak ?? 0}
          suffix="天"
          color="text-warning"
        />
        <BigStat
          icon={<Target className="h-4 w-4" />}
          label="今日新词"
          value={loading ? "—" : stats.newWords}
          color="text-primary"
        />
        <BigStat
          icon={<BarChart3 className="h-4 w-4" />}
          label="今日复习"
          value={loading ? "—" : stats.reviewWords}
          color="text-success"
        />
        <BigStat
          icon={<TrendingUp className="h-4 w-4" />}
          label="学习时长"
          value={loading ? "—" : stats.durationMinutes}
          suffix="分钟"
          color="text-accent"
        />
      </div>

      {/* 30 天打卡日历 */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold">近 30 天学习</h3>
        <p className="mt-1 text-xs text-muted">柱越高表示当日学习量越大</p>
        <div className="mt-4 flex items-end gap-1">
          {days.map((d) => {
            const height = d.total === 0 ? 4 : Math.max(8, (d.total / maxTotal) * 80);
            const isToday = d.key === days[days.length - 1].key;
            return (
              <div
                key={d.key}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.key}: ${d.total} 词`}
              >
                <div
                  className={`w-full rounded-t ${
                    d.total === 0
                      ? "bg-surface-muted"
                      : isToday
                      ? "bg-primary"
                      : "bg-primary/60"
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className={`text-[9px] ${isToday ? "font-bold text-primary" : "text-text-tertiary"}`}>
                  {d.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 今日详情 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <h4 className="text-sm font-semibold">今日学习详情</h4>
          <div className="mt-4 space-y-3">
            <Row label="新词学习" value={stats.newWords} />
            <Row label="单词复习" value={stats.reviewWords} />
            <Row label="掌握新词" value={stats.masteredWords} />
            <Row label="听力练习" value={stats.listeningCount} />
            <Row label="听力正确" value={stats.listeningCorrect} />
          </div>
        </Card>
        <Card className="p-5">
          <h4 className="text-sm font-semibold">鼓励</h4>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            {streak && streak.streak >= 7
              ? `🔥 连续打卡 ${streak.streak} 天了！你已经养成习惯，继续保持！`
              : streak && streak.streak >= 3
              ? `👏 已连续打卡 ${streak.streak} 天，坚持就是胜利！`
              : loading
              ? "加载中..."
              : "从今天开始打卡，坚持 21 天养成习惯。每天学一点，积累的力量超乎想象。"}
          </p>
          <p className="mt-3 text-xs text-text-tertiary">
            记忆曲线告诉我们：当天复习，24 小时后还记得 80%。
          </p>
        </Card>
      </div>
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-text-tertiary">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-text"}`}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-muted">{suffix}</span>}
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
