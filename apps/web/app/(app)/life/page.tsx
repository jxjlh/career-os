"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, PencilLine, RefreshCw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CareerPlanningSection } from "@/components/career/career-planning-section";
import { CheckinStreakCard } from "@/components/life/checkin-streak-card";
import { LifeGoalBoard } from "@/components/life/life-goal-board";
import { LifeMapClient } from "@/components/life/map/life-map-client";
import { MapTimeline } from "@/components/life/map/map-timeline";
import { Button, Card, Input, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getLifeGoals, getGoalSuggestions, createLifeGoal, type GoalSuggestion } from "@/lib/life";
import { getLifeMap } from "@/lib/life-map";

const SUGGESTIONS_HIDDEN_KEY = "life-goal-suggestions-hidden";

export default function LifeGoalsPage() {
  const queryClient = useQueryClient();
  const [editingMotto, setEditingMotto] = useState(false);
  const [motto, setMotto] = useState("");
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  const profile = useQuery({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch<{ data: any }>("/profile"),
  });
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

  useEffect(() => {
    if (profile.data?.data?.lifeMotto) setMotto(profile.data.data.lifeMotto);
  }, [profile.data]);

  const saveMotto = useMutation({
    mutationFn: () =>
      apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify({ lifeMotto: motto }),
      }),
    onSuccess: () => {
      setEditingMotto(false);
      queryClient.invalidateQueries({ queryKey: ["life-profile"] });
    },
  });

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

  if (goals.isLoading || profile.isLoading) {
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
      {/* 人生格言 */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-r from-primary/12 via-accent/8 to-transparent p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">人生格言</p>
              {editingMotto ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                    placeholder="写下你的人生格言..."
                    className="max-w-md"
                  />
                  <Button size="sm" onClick={() => saveMotto.mutate()} disabled={saveMotto.isPending}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingMotto(false)}>
                    取消
                  </Button>
                </div>
              ) : (
                <p className="mt-1.5 text-lg font-semibold leading-snug sm:text-xl">
                  {motto || "给自己一句人生格言，让每个目标都有方向。"}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingMotto((v) => !v)} aria-label="编辑格言">
              <PencilLine className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

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

      {/* 职业规划 */}
      <CareerPlanningSection />

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
