"use client";

import { AlertTriangle, CheckCircle2, Eye, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge, Button, Card } from "@/components/ui";
import type { FinanceRecommendation } from "@/lib/finance";
import { toPercent } from "@/lib/finance";

const ACTION_META = {
  observe: { label: "继续观察", icon: Eye, variant: "default" },
  build: { label: "分批建仓", icon: TrendingUp, variant: "primary" },
  add: { label: "考虑加仓", icon: TrendingUp, variant: "success" },
  pause: { label: "暂缓操作", icon: Minus, variant: "warning" },
  rebalance: { label: "调整配置", icon: AlertTriangle, variant: "warning" },
  reduce_risk: { label: "降低风险", icon: TrendingDown, variant: "danger" },
  exit_review: { label: "复核退出", icon: AlertTriangle, variant: "danger" },
} as const;

export function RecommendationCard({ item, onDismiss, isDismissing = false }: { item: FinanceRecommendation; onDismiss: () => void; isDismissing?: boolean }) {
  const meta = ACTION_META[item.action] ?? ACTION_META.observe;
  const Icon = meta.icon;
  const hasRange = item.suggestedAllocationMin || item.suggestedAllocationMax;

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{item.title}</p>
            <p className="mt-0.5 text-xs text-text-tertiary">规则引擎已核对条件</p>
          </div>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-text-secondary">{item.explanation || "请结合自身资金安排，先复核规则依据再操作。"}</p>
      {hasRange && (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          建议配置区间：{toPercent(item.suggestedAllocationMin)} – {toPercent(item.suggestedAllocationMax)}
        </p>
      )}
      {item.evidence.length > 0 && <p className="mt-3 text-xs text-text-tertiary">依据：{item.evidence.map((e) => e.message).filter(Boolean).join("；")}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary"><CheckCircle2 className="h-3.5 w-3.5" />仅供决策参考</span>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={isDismissing}>不再提醒</Button>
      </div>
    </Card>
  );
}
