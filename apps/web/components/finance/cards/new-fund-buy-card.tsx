"use client";

import { BadgeCheck, Coins, DollarSign, ShieldAlert, ShoppingCart } from "lucide-react";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { displayMoney, toPercent, type FinanceCurrency, type NewFundBuyCard as NewFundBuyCardType } from "@/lib/finance";

export function NewFundBuyCardView({
  card,
  baseCurrency,
  onGoCandidates,
}: {
  card?: NewFundBuyCardType | null;
  baseCurrency: FinanceCurrency;
  onGoCandidates?: () => void;
}) {
  if (!card) {
    return (
      <section>
        <SectionHeader title="新基金买入卡" subtitle="基于仓位集中度、风险偏好、现金比例和候选基金，给出是否适合买、买哪只、买多少。" />
        <Card className="p-5 text-sm text-text-tertiary">等待理财服务生成买入建议…</Card>
      </section>
    );
  }
  const riskLabel: Record<string, string> = { conservative: "保守", balanced: "平衡", aggressive: "进取" };

  return (
    <section>
      <SectionHeader title="新基金买入卡" subtitle="基于仓位集中度、风险偏好、现金比例和候选基金，给出是否适合买、买哪只、买多少。" />
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {card.eligibleForBuy ? (
                <Badge variant="success"><ShoppingCart className="mr-1 h-3 w-3" /> 适合买入</Badge>
              ) : (
                <Badge variant="warning"><ShieldAlert className="mr-1 h-3 w-3" /> 暂不建议新买入</Badge>
              )}
              <span className="text-xs text-text-tertiary">风险偏好：{riskLabel[card.riskPreference] ?? card.riskPreference}</span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              可用现金 {displayMoney(card.availableCash, baseCurrency)}（{toPercent(card.cashRatio)}） / 预留现金要求 {toPercent(card.reserveCashRatio)}；
              单一标的集中度上限 {toPercent(card.maxInstrumentConcentration)}；候选基金 {card.candidateCount} 只。
            </p>
          </div>
        </div>
        {card.recommendation ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold text-text">
                  <BadgeCheck className="mr-1 inline h-4 w-4 text-primary" />
                  {card.recommendation.name}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">{card.recommendation.symbol || card.recommendation.instrumentId} · {card.recommendation.assetClass}</p>
              </div>
              <Badge variant="primary">优先评估</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-muted px-3 py-2 text-xs">
                <p className="text-text-tertiary">建议买入区间</p>
                <p className="mt-1 font-semibold text-text">
                  <DollarSign className="mr-0.5 inline h-3.5 w-3.5" />
                  {displayMoney(card.recommendation.suggestedBuyMin, baseCurrency)} – {displayMoney(card.recommendation.suggestedBuyMax, baseCurrency)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted px-3 py-2 text-xs">
                <p className="text-text-tertiary">目标配置区间</p>
                <p className="mt-1 font-semibold text-text"><Coins className="mr-0.5 inline h-3.5 w-3.5" />{toPercent(card.recommendation.targetMin)} – {toPercent(card.recommendation.targetMax)}</p>
              </div>
              <div className="rounded-xl bg-surface-muted px-3 py-2 text-xs">
                <p className="text-text-tertiary">是否适合买入</p>
                <p className={`mt-1 font-semibold ${card.eligibleForBuy ? "text-success" : "text-warning"}`}>{card.eligibleForBuy ? "可建仓 / 可加仓" : "现金不足，先观望"}</p>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-6 text-text-secondary">{card.recommendation.reason}</p>
          </div>
        ) : (
          <EmptyState
            title="候选基金池为空"
            description="先在下方候选基金模块加入要研究的标的，并将其研究状态改为「准备就绪」，这里就会按规则自动给出买入建议。"
            action={onGoCandidates ? <Button size="sm" variant="outline" onClick={onGoCandidates}>前往候选池</Button> : undefined}
          />
        )}
      </Card>
    </section>
  );
}
