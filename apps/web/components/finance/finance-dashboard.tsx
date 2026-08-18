"use client";

import { BarChart3, CircleAlert, Database, RefreshCw, WalletCards } from "lucide-react";

import { EChart } from "@/components/chart";
import { Badge, Button, Card, SectionHeader, Skeleton, StatCard } from "@/components/ui";
import { displayMoney, type FinanceAnalysisRun, type FinanceDashboard } from "@/lib/finance";

export function FinanceDashboardView({ dashboard, analysis, isLoading, error, onRunAnalysis, isRunning }: { dashboard?: FinanceDashboard; analysis?: FinanceAnalysisRun | null; isLoading: boolean; error?: string | null; onRunAnalysis: () => void; isRunning?: boolean }) {
  if (isLoading) return <div className="space-y-5"><Skeleton className="h-24" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>;
  if (!dashboard) return <Card className="p-6"><p className="font-medium text-text">暂时无法加载个人理财数据</p><p className="mt-2 text-sm text-danger">{error || "请稍后重试。"}</p></Card>;
  const summary = dashboard.summary;
  const dataState = analysis?.dataStatus.state ?? "未运行";
  const isFresh = dataState === "fresh" || dataState === "available";
  const allocation = Object.entries(summary.costBasisByCurrency).map(([currency, value]) => ({ name: currency, value: Number(value) || 0 }));
  const chartOption = { tooltip: { trigger: "item" }, series: [{ type: "pie", radius: ["54%", "78%"], label: { color: "#8c8a98" }, itemStyle: { borderColor: "#17151f", borderWidth: 3, borderRadius: 5 }, data: allocation.length ? allocation : [{ name: "暂无持仓", value: 1, itemStyle: { color: "#4a4757" } }] }] };

  return <div className="space-y-5"><SectionHeader title="个人理财" subtitle="规则决定行动，AI 只解释已满足的规则条件。" action={<Button variant="outline" size="sm" onClick={onRunAnalysis} disabled={isRunning}>{isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{isRunning ? "分析中…" : "更新分析"}</Button>} /><Card className="overflow-hidden p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-display text-lg font-bold text-text">资产概览</p><Badge variant={isFresh ? "success" : "warning"}>{isFresh ? "行情可用" : "仅手工数据"}</Badge></div><p className="mt-1 text-xs text-text-tertiary">{analysis?.dataFreshAt ? `最新行情：${new Date(analysis.dataFreshAt).toLocaleString("zh-CN")}` : `数据状态：${analysis?.dataStatus.reason || "尚未获取授权行情"}`}</p></div><div className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-xs text-text-secondary"><Database className="h-4 w-4 text-primary" />{dashboard.dataStatus === "manual_only" ? "持仓来自手工记账" : dashboard.dataStatus}</div></div></Card><div className="grid gap-4 sm:grid-cols-3"><StatCard label="持仓成本" value={displayMoney(summary.costBasis, summary.baseCurrency)} icon={<WalletCards className="h-4 w-4 text-primary" />} trend={summary.positionCount ? `${summary.positionCount} 个持仓` : "待录入"} /><StatCard label="估值市值" value={displayMoney(summary.marketValue, summary.baseCurrency)} icon={<BarChart3 className="h-4 w-4 text-success" />} trend={summary.pricedPositionCount ? `${summary.pricedPositionCount}/${summary.positionCount} 已估值` : "等待行情"} /><StatCard label="规则状态" value={analysis?.status === "completed" ? "已完成" : "待更新"} icon={<CircleAlert className="h-4 w-4 text-warning" />} trend={analysis?.explanation?.slice(0, 34) || "暂无买卖建议"} /></div><Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-text">资金币种分布</p><p className="mt-1 text-xs text-text-tertiary">多币种不强行换算，避免产生虚假的总收益。</p></div><Badge>{summary.baseCurrency} 基准</Badge></div><EChart option={chartOption} height={220} className="mt-2" /></Card></div>;
}
