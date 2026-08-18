"use client";

import { Bell, CircleAlert, Database, RefreshCw } from "lucide-react";

import { AssetSummaryCard } from "@/components/finance/cards/asset-summary-card";
import { Badge, Button, Card, SectionHeader, Skeleton } from "@/components/ui";
import type { FinanceAnalysisRun, FinanceDashboard } from "@/lib/finance";

export function FinanceDashboardView({
  dashboard,
  analysis,
  pendingActionCount,
  isLoading,
  error,
  onRunAnalysis,
  isRunning,
}: {
  dashboard?: FinanceDashboard;
  analysis?: FinanceAnalysisRun | null;
  pendingActionCount?: number;
  isLoading: boolean;
  error?: string | null;
  onRunAnalysis: () => void;
  isRunning?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }
  if (!dashboard) {
    return (
      <Card className="p-6">
        <p className="font-medium text-text">暂时无法加载个人理财数据</p>
        <p className="mt-2 text-sm text-danger">{error || "请稍后重试。"}</p>
      </Card>
    );
  }
  const summary = dashboard.summary;
  const dataState = analysis?.dataStatus.state ?? "未运行";
  const isFresh = dataState === "fresh" || dataState === "available";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="个人理财"
        subtitle="规则决定行动，AI 只解释已满足的规则条件；所有建议绝不自动下单。"
        action={
          <div className="flex items-center gap-2">
            {pendingActionCount && pendingActionCount > 0 ? (
              <Badge variant="danger">
                <Bell className="mr-1 h-3 w-3" />
                {pendingActionCount} 条未读行动卡
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={onRunAnalysis} disabled={isRunning}>
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isRunning ? "分析中…" : "更新分析"}
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-lg font-bold text-text">分析与数据状态</p>
              <Badge variant={isFresh ? "success" : "warning"}>{isFresh ? "行情可用" : "仅手工数据"}</Badge>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              {analysis?.dataFreshAt
                ? `最新行情：${new Date(analysis.dataFreshAt).toLocaleString("zh-CN")}`
                : `数据状态：${analysis?.dataStatus.reason || "尚未获取授权行情"}`}
            </p>
            <p className="mt-1 text-[11px] text-text-tertiary">
              固定每日北京时间 14:45 自动生成分析（确保在 15:00 收盘前推送未读行动卡通知）。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-xs text-text-secondary">
            <Database className="h-4 w-4 text-primary" />
            {dashboard.dataStatus === "manual_only" ? "持仓来自手工记账" : dashboard.dataStatus}
          </div>
        </div>
      </Card>

      <AssetSummaryCard summary={summary} latestAt={analysis?.dataFreshAt ?? analysis?.completedAt} />
    </div>
  );
}
