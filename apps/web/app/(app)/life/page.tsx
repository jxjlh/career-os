"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Brain, Camera, Images, ListChecks, MapPin, RefreshCw, Users } from "lucide-react";
import Link from "next/link";

import { DailyAssistantCard } from "@/components/life/assistant/daily-assistant-card";
import { CheckinStreakCard } from "@/components/life/checkin-streak-card";
import { SocialOverviewCard } from "@/components/life/social/social-overview-card";
import { LifeCategoryCard } from "@/components/life/life-category-card";
import { LifeHeader } from "@/components/life/life-header";
import { LifeLevelCard } from "@/components/life/life-level-card";
import { LifeProgressCard } from "@/components/life/life-progress-card";
import { RecentCompletedCard } from "@/components/life/recent-completed-card";
import { Button, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getLevelInfo, getLifeDashboard } from "@/lib/life";

type Envelope = { data: any };

export default function LifePage() {
  const dashboard = useQuery({
    queryKey: ["life-dashboard"],
    queryFn: getLifeDashboard,
  });
  const profile = useQuery<Envelope>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
  });

  if (dashboard.isLoading || profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">加载人生数据失败</p>
        <Button onClick={() => dashboard.refetch()}>
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  if (!dashboard.data) return null;
  const data = dashboard.data;
  const nickname = profile.data?.data?.nickname || "我的人生";
  const avatar = profile.data?.data?.avatar;
  const levelInfo = getLevelInfo(data.level, data.experience);
  const categories = Object.entries(data.categoryStats || {});

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <LifeHeader nickname={nickname} avatar={avatar} level={data.level} />

      <DailyAssistantCard showHeader />

      {/* Sprint 7: 连续打卡卡 */}
      <CheckinStreakCard />

      {/* Sprint 8: 人生社交概览 */}
      <SocialOverviewCard />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/life/coach" className="flex items-center justify-between rounded-[12px] border border-border bg-gradient-to-br from-violet-500/15 to-indigo-500/10 p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4 text-violet-500" />
            Life AI Coach
          </span>
          <span className="text-xs text-muted">对话 →</span>
        </Link>
        <Link href="/life/social" className="flex items-center justify-between rounded-[12px] border border-border bg-gradient-to-br from-indigo-500/10 to-pink-500/5 p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            人生社交
          </span>
          <span className="text-xs text-muted">分享成长 →</span>
        </Link>
        <Link href="/life/camera" className="flex items-center justify-between rounded-[12px] border border-border bg-gradient-to-br from-rose-500/10 to-orange-500/5 p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4 text-primary" />
            AI 相机
          </span>
          <span className="text-xs text-muted">记录此刻 →</span>
        </Link>
        <Link href="/life/bucket" className="flex items-center justify-between rounded-[12px] border border-border bg-gradient-to-br from-indigo-500/5 to-pink-500/5 p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4 text-primary" />
            人生必做清单
          </span>
          <span className="text-xs text-muted">探索 →</span>
        </Link>
        <Link href="/life/records" className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Images className="h-4 w-4 text-primary" />
            我的人生记录
          </span>
          <span className="text-xs text-muted">时间轴 →</span>
        </Link>
        <Link href="/life/map" className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            人生地图
          </span>
          <span className="text-xs text-muted">查看足迹 →</span>
        </Link>
        <Link href="/life/review" className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            我的年度报告
          </span>
          <span className="text-xs text-muted">查看报告 →</span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LifeLevelCard
          level={data.level}
          experience={data.experience}
          progressPercent={levelInfo.progressPercent}
          remaining={levelInfo.remaining}
        />
        <LifeProgressCard
          total={data.totalGoals}
          completed={data.completedGoals}
          rate={data.completionRate}
        />
      </div>

      {data.totalGoals === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-lg font-semibold">你的第一个人生目标，从今天开始。</p>
          <p className="mt-1 text-[13px] text-muted">创建旅行、成长、职业或关系目标，开始记录你的人生进度。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {categories.map(([category, stat]) => (
              <LifeCategoryCard
                key={category}
                category={category}
                total={stat.total}
                completed={stat.completed}
              />
            ))}
          </div>
          <RecentCompletedCard items={data.recentCompleted} />
        </>
      )}

    </div>
  );
}
