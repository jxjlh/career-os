"use client";

import { BadgeCheck, CalendarCheck2, Coins, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Badge, Card, Skeleton, StatCard } from "@/components/ui";
import { displayMoney, toPercent, type FinanceDashboardSummary } from "@/lib/finance";

const isPositive = (value: string | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};
const isNegative = (value: string | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) && n < 0;
};

export function AssetSummaryCard({ summary, latestAt }: { summary: FinanceDashboardSummary; latestAt?: string | null }) {
  const currency = summary.baseCurrency;
  const totalPositionValue = summary.totalPositionValue ?? summary.marketValue;
  const costBasis = summary.costBasis;
  const dayChange = summary.dayChange;
  const cumulativeReturn = summary.cumulativeReturn;
  const returnRate = summary.returnRate;
  const cashRatio = summary.cashRatio;

  const trendDay = isPositive(dayChange) ? "up" : isNegative(dayChange) ? "down" : "flat";
  const trendCum = isPositive(cumulativeReturn) ? "up" : isNegative(cumulativeReturn) ? "down" : "flat";

  const items = [
    {
      label: "总仓位金额",
      hint: "持仓市值，不含现金",
      value: displayMoney(totalPositionValue, currency),
      icon: <Wallet className="h-4 w-4 text-primary" />,
      trend: summary.positionCount ? `${summary.positionCount} 个持仓` : "待录入",
    },
    {
      label: "持仓成本",
      hint: "不含现金",
      value: displayMoney(costBasis, currency),
      icon: <PiggyBank className="h-4 w-4 text-text-secondary" />,
      trend: summary.positionCount ? `${summary.pricedPositionCount}/${summary.positionCount} 已估值` : "待录入",
    },
    {
      label: "今日收益",
      hint: "估算，基于当日涨跌幅",
      value: displayMoney(dayChange, currency),
      icon: trendDay === "up" ? <TrendingUp className="h-4 w-4 text-success" /> : trendDay === "down" ? <TrendingDown className="h-4 w-4 text-danger" /> : <BadgeCheck className="h-4 w-4 text-text-secondary" />,
      trend: trendDay === "up" ? "当日浮盈" : trendDay === "down" ? "当日浮亏" : "无估算数据",
      trendVariant: trendDay === "up" ? "success" : trendDay === "down" ? "danger" : undefined,
    },
    {
      label: "累计收益",
      hint: "市值 - 成本",
      value: displayMoney(cumulativeReturn, currency),
      icon: trendCum === "up" ? <TrendingUp className="h-4 w-4 text-success" /> : trendCum === "down" ? <TrendingDown className="h-4 w-4 text-danger" /> : <BadgeCheck className="h-4 w-4 text-text-secondary" />,
      trend: trendCum === "up" ? "累计浮盈" : trendCum === "down" ? "累计浮亏" : "持平",
      trendVariant: trendCum === "up" ? "success" : trendCum === "down" ? "danger" : undefined,
    },
    {
      label: "收益率",
      hint: "累计收益 / 成本",
      value: toPercent(returnRate),
      icon: <Coins className="h-4 w-4 text-primary" />,
      trend: summary.positionCount ? "基于真实记账数据" : "暂无持仓",
    },
    {
      label: "可用现金比例",
      hint: "现金 / 总资产",
      value: toPercent(cashRatio),
      icon: <CalendarCheck2 className="h-4 w-4 text-primary" />,
      trend: `可用现金 ${displayMoney(summary.availableCash, currency)}`,
    },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-bold text-text">总资产卡</p>
          <p className="mt-1 text-xs text-text-tertiary">
            金额、时点、收益一目了然；任何建议不会自动下单。
            {latestAt ? `  数据更新：${new Date(latestAt).toLocaleString("zh-CN")}` : ""}
          </p>
        </div>
        <Badge variant="default">{currency} 基准</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-surface-elevated px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-muted text-text-secondary">{item.icon}</span>
                <div>
                  <p className="text-[13px] font-medium text-text">{item.label}</p>
                  <p className="text-[11px] text-text-tertiary">{item.hint}</p>
                </div>
              </div>
              {item.trendVariant ? <Badge variant={item.trendVariant as any}>{item.trend}</Badge> : null}
            </div>
            <p className="mt-3 font-display text-xl font-bold text-text">{item.value ?? <Skeleton className="h-6 w-20" />}</p>
            <p className="mt-1 text-xs text-text-tertiary">{!item.trendVariant ? item.trend : ""}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
