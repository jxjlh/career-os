"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { LifePlanView, getPlanLabel } from "@/components/life/ai/life-plan-view";
import { Button, Card, Skeleton } from "@/components/ui";
import { generateLifePlan, generateTasksFromPlan, getLatestLifePlan } from "@/lib/life";

/**
 * 目标详情页的「按分类生成的 AI 规划」区块（旅游型走 TravelPlanSection）。
 *
 * 按需出现：没有规划时只占一行入口，不干扰下面的成长任务；生成过就保存到当前
 * 目标下，下次进来直接展开，还能一键把规划落成成长任务。
 */
export function LifePlanSection({
  goalId,
  category,
}: {
  goalId: string;
  category?: string | null;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const label = getPlanLabel(category);

  const planQuery = useQuery({
    queryKey: ["life-plan-latest", goalId],
    queryFn: () => getLatestLifePlan(goalId),
    enabled: Boolean(goalId),
  });

  const generate = useMutation({
    mutationFn: () => generateLifePlan({ goalId, category }),
    onSuccess: () => {
      setNotice(null);
      void queryClient.invalidateQueries({ queryKey: ["life-plan-latest", goalId] });
    },
  });

  const toTasks = useMutation({
    mutationFn: (aiContentId: string) => generateTasksFromPlan(aiContentId),
    onSuccess: (result) => {
      setNotice(`已按规划生成 ${result.createdCount} 条成长任务`);
      void queryClient.invalidateQueries({ queryKey: ["life-goal-tasks", goalId] });
      void queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
    },
    onError: (error: Error) => setNotice(error.message || "生成任务失败，请稍后重试"),
  });

  if (planQuery.isLoading) return <Skeleton className="h-32" />;

  if (planQuery.isError) {
    return (
      <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface p-4">
        <span className="text-sm text-muted">{label}加载失败</span>
        <Button variant="outline" size="sm" onClick={() => planQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const plan = planQuery.data ?? null;

  // 已生成过 → 直接展开（这就是「保存到当前目标下」：下次进来还在）
  if (plan) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{label}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toTasks.mutate(plan.aiContentId)}
              disabled={toTasks.isPending}
            >
              {toTasks.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListPlus className="h-3.5 w-3.5" />
              )}
              按规划生成任务
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              重新生成
            </Button>
          </div>
        </div>
        {notice && <p className="text-[13px] text-muted">{notice}</p>}
        {generate.isError && (
          <p className="text-[13px] text-danger">
            {(generate.error as Error).message || "重新生成失败，请稍后重试"}
          </p>
        )}
        <LifePlanView plan={plan} />
      </div>
    );
  }

  // 还没有规划 → 只留一行入口，不打断下面的成长任务
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">让 AI 出一份{label}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          直接读这个目标已经填好的信息，生成阶段安排、里程碑和逐日任务。
        </p>
        {generate.isError && (
          <p className="mt-1 text-[13px] text-danger">
            {(generate.error as Error).message || "生成失败，请稍后重试"}
          </p>
        )}
      </div>
      <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
        {generate.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {generate.isPending ? "AI 正在规划…" : "AI 生成规划"}
      </Button>
    </Card>
  );
}
