"use client";

import { BarChart3, CircleAlert, LineChart, Newspaper, TrendingDown, TrendingUp } from "lucide-react";

import { Badge, Card, SectionHeader } from "@/components/ui";
import { toPercent, type FinanceMarketDaily } from "@/lib/finance";

export function MarketDailyCard({ daily }: { daily?: FinanceMarketDaily | null }) {
  if (!daily) {
    return (
      <section>
        <SectionHeader title="市场日报卡" subtitle="每日市场概览、主要指数表现、风格/行业变化，再结合你的真实持仓说明影响。" />
        <Card className="p-5 text-sm text-text-tertiary">等待行情授权后生成市场日报…</Card>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader title="市场日报卡" subtitle="每日市场概览、主要指数表现、风格/行业变化，再结合你的真实持仓说明影响。" />
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Newspaper className="h-4 w-4" /></span>
            <div>
              <p className="font-display text-base font-bold text-text">{daily.date} 市场日报</p>
              <p className="mt-1 text-[13px] leading-6 text-text-secondary">{daily.overview}</p>
            </div>
          </div>
          <Badge variant="default">系统 14:45 自动生成</Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-text">主要指数表现</p>
            </div>
            <div className="mt-3 divide-y divide-border">
              {daily.indexPerformances.map((row) => {
                const change = Number(row.changePercent);
                const up = Number.isFinite(change) && change > 0;
                const down = Number.isFinite(change) && change < 0;
                return (
                  <div key={row.symbol} className="grid grid-cols-12 items-center gap-2 py-2 text-xs">
                    <p className="col-span-4 truncate font-medium text-text">{row.name}</p>
                    <p className="col-span-4 truncate text-text-tertiary">{row.symbol}</p>
                    <p className="col-span-2 text-right text-text-secondary">{row.price ?? "—"}</p>
                    <p className={`col-span-2 text-right font-semibold ${up ? "text-success" : down ? "text-danger" : "text-text-tertiary"} flex items-center justify-end gap-1`}>
                      {row.changePercent == null ? "—" : (
                        <>
                          {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : null}
                          {toPercent(String(Number(row.changePercent) / 100))}
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-text">风格 / 行业变化</p>
              </div>
              {daily.styleAndSectorChanges.length ? (
                <ul className="mt-3 space-y-1 text-[13px] text-text-secondary">
                  {daily.styleAndSectorChanges.map((note, i) => <li key={i} className="flex gap-2"><span className="text-text-tertiary">·</span>{note}</li>)}
                </ul>
              ) : <p className="mt-3 text-xs text-text-tertiary">暂无数据</p>}
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-warning" />
                <p className="text-sm font-semibold text-text">对你真实持仓的影响</p>
              </div>
              {daily.portfolioImpact.length ? (
                <ul className="mt-3 space-y-2 text-[13px] leading-6 text-text-secondary">
                  {daily.portfolioImpact.map((note, i) => <li key={i} className="flex gap-2"><span className="text-text-tertiary">·</span>{note}</li>)}
                </ul>
              ) : <p className="mt-3 text-xs text-text-tertiary">暂无持仓影响分析</p>}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
