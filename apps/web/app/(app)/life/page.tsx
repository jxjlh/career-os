"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Images, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AiEntryCard } from "@/components/life/ai-entry-card";
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/life/records" className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Images className="h-4 w-4 text-primary" />
            我的人生记录
          </span>
          <span className="text-xs text-muted">时间轴 →</span>
        </Link>
        <Link href="/life/review" className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40">
          <span className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            年度人生总结
          </span>
          <span className="text-xs text-muted">年度回顾 →</span>
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

      <AiEntryCard />
    </div>
  );
}
