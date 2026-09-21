"use client";

import { useQuery } from "@tanstack/react-query";
import { Map, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";

import { TravelPlanView } from "@/components/life/ai/travel-plan-view";
import { Button, Card, Skeleton } from "@/components/ui";
import { getLatestTravelPlan } from "@/lib/life";

/**
 * 目标详情页的「AI 旅行攻略」区块：世界探索类目标用它替代「成长任务」。
 * 已生成过 → 直接渲染攻略；没生成过 → 引导态 + 跳转生成页。
 */
export function TravelPlanSection({ goalId }: { goalId: string }) {
  const planQuery = useQuery({
    queryKey: ["travel-plan-latest", goalId],
    queryFn: () => getLatestTravelPlan(goalId),
    enabled: Boolean(goalId),
  });

  if (planQuery.isLoading) return <Skeleton className="h-44" />;

  const generateHref = `/life/goals/ai?goalId=${goalId}`;
  const plan = planQuery.data ?? null;

  if (planQuery.isError) {
    return (
      <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface p-4">
        <span className="text-sm text-muted">旅行攻略加载失败</span>
        <Button variant="outline" size="sm" onClick={() => planQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  if (!plan) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold">AI 旅行攻略</h2>
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <Map className="h-5 w-5 text-muted" />
          <p className="text-sm font-medium">还没有旅行攻略</p>
          <p className="max-w-sm text-[13px] text-muted">
            把目的地、天数、预算和同行人交给 AI，直接产出逐日行程、行前准备与注意事项。
          </p>
          <Link href={generateHref} className="mt-2">
            <Button size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI 生成旅行攻略
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">AI 旅行攻略</h2>
        <Link href={generateHref}>
          <Button variant="ghost" size="sm">
            <RefreshCw className="h-3.5 w-3.5" />
            重新生成
          </Button>
        </Link>
      </div>
      <TravelPlanView plan={plan} />
    </div>
  );
}
