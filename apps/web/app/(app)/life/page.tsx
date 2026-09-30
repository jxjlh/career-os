"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, RefreshCw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CheckinStreakCard } from "@/components/life/checkin-streak-card";
import { LifeGoalBoard } from "@/components/life/life-goal-board";
import { LifeMapClient } from "@/components/life/map/life-map-client";
import { MapTimeline } from "@/components/life/map/map-timeline";
import { MottoBanner } from "@/components/motto-banner";
import { Button, Card, Skeleton } from "@/components/ui";
import { getLifeGoals, getGoalSuggestions, createLifeGoal, type GoalSuggestion } from "@/lib/life";
import { getLifeMap } from "@/lib/life-map";

const SUGGESTIONS_HIDDEN_KEY = "life-goal-suggestions-hidden";

export default function LifeGoalsPage() {
  const queryClient = useQueryClient();
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  const goals = useQuery({
    queryKey: ["life-goals"],
    queryFn: getLifeGoals,
  });
  const map = useQuery({
    queryKey: ["life-map"],
    queryFn: () => getLifeMap(),
  });
  const suggestions = useQuery({
    queryKey: ["life-goal-suggestions"],
    queryFn: getGoalSuggestions,
  });

  useEffect(() => {
    setSuggestionsHidden(localStorage.getItem(SUGGESTIONS_HIDDEN_KEY) === "1");
  }, []);

  const quickAdd = useMutation({
    mutationFn: (item: GoalSuggestion) =>
      createLifeGoal({
        title: item.title,
        category: item.category,
        description: item.description,
        location: item.suggested.location,
        budget: item.suggested.budget,
        recommendedDays: item.suggested.recommendedDays,
        bestSeason: item.suggested.bestSeason,
        region: item.suggested.region,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
      queryClient.invalidateQueries({ queryKey: ["life-goal-suggestions"] });
    },
  });

  const hideSuggestions = () => {
    localStorage.setItem(SUGGESTIONS_HIDDEN_KEY, "1");
    setSuggestionsHidden(true);
  };

  if (goals.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (goals.isError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">加载人生目标失败</p>
        <Button onClick={() => goals.refetch()}>
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  const goalItems = goals.data || [];
  const markers = map.data?.markers || [];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* 人生格言：与首页「座右铭」同一个组件、同一份数据，可选中部分文字改颜色 / 字号 */}
      <MottoBanner />

      <CheckinStreakCard />

      {/* 三栏目标看板 */}
      <LifeGoalBoard goals={goalItems} />

      {/* 地图 + 时间轴 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              人生地图
            </h2>
            <p className="text-[12px] text-muted">自动关联人生清单中出现的地点，点击标记查看完成详情。</p>
          </div>
          <Link href="/life/map" className="text-xs font-medium text-primary">
            完整地图 →
          </Link>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-border">
          <div className="h-[380px] w-full sm:h-[440px]">
            {map.isLoading ? <Skeleton className="h-full w-full" /> : <LifeMapClient markers={markers} showPolyline useCluster />}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">轨迹时间轴</h3>
          <MapTimeline markers={markers} />
        </div>
      </div>

      {/* 清单建议 */}
      {!suggestionsHidden && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-ai" />
                人生清单建议
              </h2>
              <p className="mt-0.5 text-[12px] text-muted">点击可直接加入你的目标清单。</p>
            </div>
            <Button variant="ghost" size="icon" onClick={hideSuggestions} aria-label="关闭建议">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {suggestions.isLoading ? (
            <Skeleton className="mt-3 h-24" />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(suggestions.data || []).slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => quickAdd.mutate(item)}
                  disabled={quickAdd.isPending}
                  className="rounded-[10px] border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40"
                >
                  <p className="text-[13px] font-semibold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{item.description}</p>
                  {item.suggested.bestSeason && (
                    <p className="mt-1.5 text-[11px] text-primary">{item.suggested.bestSeason} · 推荐</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 快捷入口 */}
      <div className="flex flex-wrap gap-2">
        <Link href="/life/bucket">
          <Button variant="outline" size="sm">
            人生必做清单
          </Button>
        </Link>
        <Link href="/life/records">
          <Button variant="outline" size="sm">
            我的人生记录
          </Button>
        </Link>
        <Link href="/life/review">
          <Button variant="outline" size="sm">
            年度报告
          </Button>
        </Link>
      </div>
    </div>
  );
}
