"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Eye, Minus, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";

import { Badge, Button, Card } from "@/components/ui";
import { displayMoney, toPercent, type FinanceRecommendation } from "@/lib/finance";

const ACTION_META: Record<FinanceRecommendation["action"], { label: string; icon: any; variant: "success" | "danger" | "warning" | "primary" | "default" }> = {
  observe: { label: "继续观察", icon: Eye, variant: "default" },
  hold: { label: "继续持有", icon: CheckCircle2, variant: "default" },
  build: { label: "分批建仓", icon: TrendingUp, variant: "primary" },
  build_position: { label: "首次建仓", icon: ShoppingCart, variant: "primary" },
  add: { label: "考虑加仓", icon: TrendingUp, variant: "success" },
  add_position: { label: "建议加仓", icon: TrendingUp, variant: "success" },
  pause: { label: "暂缓操作", icon: Minus, variant: "warning" },
  rebalance: { label: "减仓 / 再平衡", icon: AlertTriangle, variant: "warning" },
  reduce_risk: { label: "降低风险 / 减仓", icon: TrendingDown, variant: "danger" },
  exit_review: { label: "卖出 / 复核退出", icon: TrendingDown, variant: "danger" },
};

export function RecommendationCard({
  item,
  onDismiss,
  isDismissing = false,
  baseCurrency = "CNY",
}: {
  item: FinanceRecommendation;
  onDismiss: () => void;
  isDismissing?: boolean;
  baseCurrency?: "CNY" | "HKD" | "USD";
}) {
  const meta = ACTION_META[item.action] ?? ACTION_META.observe;
  const Icon = meta.icon;
  const hasRange = item.suggestedAllocationMin || item.suggestedAllocationMax;
  const hasAmount = item.suggestedAmountMin || item.suggestedAmountMax;
  const change = Number(item.positionChangePct);
  const hasChange = Number.isFinite(change) && Math.abs(change) > 0.000001;

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
        <Badge variant={meta.variant as any}>{meta.label}</Badge>
      </div>

      <p className="mt-3 text-[13px] leading-6 text-text-secondary">
        {item.triggerReason || item.explanation || "请结合自身资金安排，先复核规则依据再操作。"}
      </p>

      {(hasAmount || hasRange || hasChange) && (
        <div className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary space-y-1">
          {hasAmount && (
            <p>建议金额：{displayMoney(item.suggestedAmountMin, baseCurrency)} – {displayMoney(item.suggestedAmountMax, baseCurrency)}</p>
          )}
          {hasChange && (
            <p className="flex items-center gap-1">
              建议仓位变化：
              {change > 0 ? (
                <span className="text-success inline-flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />+{toPercent(item.positionChangePct)}</span>
              ) : (
                <span className="text-danger inline-flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />{toPercent(item.positionChangePct)}</span>
              )}
              （相对总资产）
            </p>
          )}
          {hasRange && (
            <p>建议配置区间：{toPercent(item.suggestedAllocationMin)} – {toPercent(item.suggestedAllocationMax)}</p>
          )}
        </div>
      )}

      {item.evidence.length > 0 && (
        <p className="mt-3 text-xs text-text-tertiary">规则依据：{item.evidence.map((e) => e.message).filter(Boolean).join("；")}</p>
      )}
      {item.riskNote && (
        <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">风险提示：{item.riskNote}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
          <CheckCircle2 className="h-3.5 w-3.5" /> 仅供决策参考 · 绝不自动下单
        </span>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={isDismissing}>不再提醒</Button>
      </div>
    </Card>
  );
}
