"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Eye, Minus, Scale, TrendingDown, TrendingUp } from "lucide-react";

import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { displayMoney, toPercent, type FinanceHolding, type FinanceRecommendation, type PositionDecisionRow } from "@/lib/finance";

export type PositionDecision = {
  decision: "buy_more" | "reduce" | "sell" | "hold";
  action: FinanceRecommendation["action"];
  holding?: FinanceHolding;
  recommendation?: FinanceRecommendation;
};

const ACTION_META: Record<PositionDecision["decision"], { label: string; icon: any; variant: "success" | "danger" | "warning" | "default" }> = {
  buy_more: { label: "加仓 / 建仓", icon: TrendingUp, variant: "success" },
  reduce: { label: "减仓", icon: TrendingDown, variant: "warning" },
  sell: { label: "卖出 / 退出", icon: ArrowDownRight, variant: "danger" },
  hold: { label: "继续持有", icon: CheckCircle2, variant: "default" },
};

function decisionOf(rec: FinanceRecommendation): PositionDecision["decision"] {
  switch (rec.action) {
    case "build_position":
    case "add_position":
    case "build":
    case "add":
      return "buy_more";
    case "reduce_risk":
    case "rebalance":
      return "reduce";
    case "exit_review":
      return "sell";
    case "hold":
    case "observe":
    case "pause":
    default:
      return "hold";
  }
}

function buildDecisions(
  positions: FinanceHolding[],
  recommendations: FinanceRecommendation[],
): PositionDecision[] {
  const byInstrument = new Map<string, FinanceRecommendation>();
  const byCandidate = new Map<string, FinanceRecommendation>();
  for (const rec of recommendations) {
    if (rec.instrumentId && !rec.candidateId) byInstrument.set(rec.instrumentId, rec);
    if (rec.candidateId) byCandidate.set(rec.candidateId, rec);
  }
  const decisions: PositionDecision[] = positions
    .filter((p) => p.assetClass !== "cash")
    .map((holding) => {
      const rec = byInstrument.get(holding.instrumentId);
      const decision = rec ? decisionOf(rec) : "hold";
      return { decision, action: rec?.action ?? "hold", holding, recommendation: rec };
    });
  return decisions;
}

export function PositionDecisionCard({
  positions,
  recommendations,
  positionDecisions,
  onDismiss,
  isDismissing,
  baseCurrency,
}: {
  positions: FinanceHolding[];
  recommendations: FinanceRecommendation[];
  positionDecisions?: PositionDecisionRow[];
  baseCurrency: "CNY" | "HKD" | "USD";
  onDismiss?: (id: string) => void;
  isDismissing?: boolean;
}) {
  const usePrecomputed = positionDecisions && positionDecisions.length > 0;
  const decisions: PositionDecision[] = usePrecomputed
    ? (positionDecisions!.map((pd) => ({
        decision: pd.decision,
        action: pd.action,
        holding: pd.holding,
      })))
    : buildDecisions(positions, recommendations);

  const getRecForInstrument = (instrumentId: string): FinanceRecommendation | undefined => {
    return recommendations.find((r) => r.instrumentId === instrumentId && r.disposition !== "dismissed");
  };

  return (
    <section>
      <SectionHeader title="持仓决策卡" subtitle="每只基金明确动作（加仓 / 减仓 / 卖出 / 继续持有）、建议金额、仓位变化、触发原因和风险提示。" />
      {!decisions.length ? (
        <Card className="p-6 text-sm text-text-secondary">暂时还没有持仓决策；先录入持仓或点击「更新分析」。</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {decisions.map((item, idx) => {
            const meta = ACTION_META[item.decision];
            const Icon = meta.icon;
            const holding = item.holding!;
            const rec = usePrecomputed
              ? (recommendations.find((r) => r.instrumentId === holding.instrumentId && r.disposition !== "dismissed"))
              : item.recommendation;
            const amountMin = rec?.suggestedAmountMin ?? (usePrecomputed ? positionDecisions!.find((pd) => pd.positionId === holding.id)?.suggestedAmountMin : null);
            const amountMax = rec?.suggestedAmountMax ?? (usePrecomputed ? positionDecisions!.find((pd) => pd.positionId === holding.id)?.suggestedAmountMax : null);
            const changePct = rec?.positionChangePct ?? (usePrecomputed ? positionDecisions!.find((pd) => pd.positionId === holding.id)?.positionChangePct : null);
            const trigger = rec?.triggerReason ?? (usePrecomputed ? positionDecisions!.find((pd) => pd.positionId === holding.id)?.triggerReason ?? "当前未触发任何加减仓/卖出条件，系统默认建议继续持有。" : "当前未触发任何加减仓/卖出条件，系统默认建议继续持有。");
            const riskNote = rec?.riskNote ?? (usePrecomputed ? positionDecisions!.find((pd) => pd.positionId === holding.id)?.riskNote ?? "每交易日 14:45 会自动复核条件，任何条件变化都会生成新的行动卡。" : "每交易日 14:45 会自动复核条件，任何条件变化都会生成新的行动卡。");
            const marketValue = holding.marketValue ?? holding.costBasis;
            const unrealized = holding.unrealizedPnl;
            return (
              <Card key={`${holding.id}-${idx}`} className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.variant as any}>
                        <Icon className="mr-1 h-3 w-3" />
                        {meta.label}
                      </Badge>
                      <p className="truncate text-sm font-semibold text-text">{holding.instrument.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-text-tertiary truncate">{holding.instrument.symbol || holding.instrumentId} · {holding.accountName}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-surface-muted px-3 py-2">
                    <p className="text-text-tertiary">当前仓位</p>
                    <p className="mt-1 font-semibold text-text">{displayMoney(marketValue, baseCurrency)}</p>
                    <p className="mt-1 text-[11px] text-text-tertiary">成本 {displayMoney(holding.costBasis, baseCurrency)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted px-3 py-2">
                    <p className="text-text-tertiary">持仓收益</p>
                    <p className={`mt-1 font-semibold ${Number(unrealized) > 0 ? "text-success" : Number(unrealized) < 0 ? "text-danger" : "text-text"}`}>
                      {displayMoney(unrealized, baseCurrency)} <span className="text-text-tertiary font-normal">({toPercent(holding.unrealizedPnlPct)})</span>
                    </p>
                    <p className="mt-1 text-[11px] text-text-tertiary">今日 {displayMoney(holding.dayChange, baseCurrency)}</p>
                  </div>
                </div>
                {(amountMin || amountMax || changePct) && (
                  <div className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold text-text">建议动作细节</span>
                    </div>
                    <div className="mt-2 space-y-1 text-text-secondary">
                      {item.decision !== "hold" && (amountMin || amountMax) && (
                        <p>建议金额：{displayMoney(amountMin, baseCurrency)} – {displayMoney(amountMax, baseCurrency)}</p>
                      )}
                      {changePct && Number(changePct) !== 0 && (
                        <p className="flex items-center gap-1">
                          仓位变化：
                          {Number(changePct) > 0 ? (
                            <span className="inline-flex items-center text-success"><ArrowUpRight className="h-3 w-3" /> +{toPercent(changePct)}</span>
                          ) : (
                            <span className="inline-flex items-center text-danger"><ArrowDownRight className="h-3 w-3" /> {toPercent(changePct)}</span>
                          )}
                          （相对总资产）
                        </p>
                      )}
                      {item.decision === "hold" && (
                        <p className="inline-flex items-center gap-1 text-text-secondary"><Eye className="h-3 w-3" /> 无需调整当前仓位</p>
                      )}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-[13px] leading-6 text-text-secondary">
                  <span className="inline-flex items-center gap-1 font-semibold text-text"><Minus className="h-3 w-3" /> 触发原因：</span>
                  {trigger}
                </p>
                {rec?.evidence?.length ? (
                  <p className="mt-2 text-xs text-text-tertiary">规则依据：{rec.evidence.map((e) => e.message).filter(Boolean).join("；")}</p>
                ) : null}
                <p className="mt-auto pt-3 text-xs text-text-tertiary border-t border-border mt-3">风险提示：{riskNote}</p>
                {onDismiss && rec && item.decision !== "hold" && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onDismiss(rec.id)} disabled={isDismissing}>不再提醒</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
