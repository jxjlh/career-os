"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { AiSuggestionList } from "@/components/life/assistant/ai-suggestion-list";
import { ProgressSummary } from "@/components/life/assistant/progress-summary";
import { TodayFocus } from "@/components/life/assistant/today-focus";
import { Button, Skeleton } from "@/components/ui";
import { getDailyAssistant } from "@/lib/life";

export function DailyAssistantCard({ detailed = false }: { detailed?: boolean }) {
  const query = useQuery({
    queryKey: ["life-ai-daily"],
    queryFn: getDailyAssistant,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3 rounded-[12px] border border-border bg-surface p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-surface p-4">
        <p className="text-sm text-muted">今日 AI 建议加载失败</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    );
  }

  const data = query.data;
  return (
    <div className="rounded-[12px] border border-border bg-gradient-to-br from-ai/10 via-surface to-blue-500/10 p-4">
      <TodayFocus greeting={data?.greeting} focusGoal={data?.focusGoal} />
      {detailed && <AiSuggestionList tasks={data?.todayTasks} suggestions={data?.suggestions} />}
      <ProgressSummary progress={data?.progress} />
      {data?.motivation && (
        <p className="mt-3 rounded-[8px] bg-surface/70 px-3 py-2 text-[13px] text-text/80">{data.motivation}</p>
      )}
    </div>
  );
}
