"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";

import { AiSuggestionList } from "@/components/life/assistant/ai-suggestion-list";
import { AssistantProgress } from "@/components/life/assistant/assistant-progress";
import { TodayFocus } from "@/components/life/assistant/today-focus";
import { Button, Skeleton } from "@/components/ui";
import { getDailyAssistant } from "@/lib/life";

export function DailyAssistantCard({
  detailed = false,
  showHeader = false,
}: {
  detailed?: boolean;
  showHeader?: boolean;
}) {
  const query = useQuery({
    queryKey: ["life-ai-daily"],
    queryFn: getDailyAssistant,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3 rounded-[12px] border border-border bg-surface p-4">
        {showHeader && <Skeleton className="h-4 w-32" />}
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium">今日 AI 建议加载失败</p>
          <p className="text-[13px] text-muted">请稍后重试</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          重试
        </Button>
      </div>
    );
  }

  const data = query.data;
  const hasContent =
    Boolean(data?.focusGoal?.title) ||
    (data?.todayTasks?.length || 0) > 0 ||
    (data?.suggestions?.length || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[12px] border border-border bg-gradient-to-br from-ai/10 via-surface to-blue-500/10 p-4"
    >
      {showHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="h-4 w-4 text-ai" />
            🤖 今日人生助手
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              aria-label="刷新今日建议"
              title="刷新建议"
            >
              {query.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Link href="/life/assistant" className="text-xs font-medium text-primary hover:underline">
              查看完整建议 →
            </Link>
          </div>
        </div>
      )}

      {hasContent ? (
        <>
          <TodayFocus greeting={data?.greeting} focusGoal={data?.focusGoal} tasks={data?.todayTasks} />
          {detailed ? (
            <AiSuggestionList suggestions={data?.suggestions} />
          ) : (
            data?.suggestions && data.suggestions.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-text/80">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {data.suggestions[0]}
              </p>
            )
          )}
          <AssistantProgress progress={data?.progress} />
          {data?.motivation && (
            <p className="mt-3 rounded-[8px] bg-surface/70 px-3 py-2 text-[13px] text-text/80">{data.motivation}</p>
          )}
        </>
      ) : (
        <div className="py-4 text-center">
          <p className="text-sm font-medium">暂无 AI 建议</p>
          <p className="mt-1 text-[13px] text-muted">先创建一个人生目标，AI 会帮你规划每一天。</p>
        </div>
      )}
    </motion.div>
  );
}
