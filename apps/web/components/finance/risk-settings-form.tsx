"use client";

import { useEffect, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import type { FinanceProfile, RiskPreference } from "@/lib/finance";

const RISK_OPTIONS: Array<{ value: RiskPreference; label: string; description: string }> = [
  { value: "conservative", label: "稳健", description: "优先控制回撤与现金储备" },
  { value: "balanced", label: "平衡", description: "在增长和波动间保持取舍" },
  { value: "aggressive", label: "进取", description: "接受更高波动，仍遵守仓位上限" },
];

export function RiskSettingsForm({ profile, onSave, isSaving, error }: { profile: FinanceProfile; onSave: (payload: Pick<FinanceProfile, "riskPreference" | "reserveCashRatio" | "maxInstrumentConcentration">) => void; isSaving?: boolean; error?: string | null }) {
  const [riskPreference, setRiskPreference] = useState<RiskPreference>(profile.riskPreference);
  const [reserveCashRatio, setReserveCashRatio] = useState(profile.reserveCashRatio);
  const [maxInstrumentConcentration, setMaxInstrumentConcentration] = useState(profile.maxInstrumentConcentration);

  useEffect(() => {
    setRiskPreference(profile.riskPreference);
    setReserveCashRatio(profile.reserveCashRatio);
    setMaxInstrumentConcentration(profile.maxInstrumentConcentration);
  }, [profile]);

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-text">风险与仓位</p>
      <p className="mt-1 text-xs leading-5 text-text-tertiary">风险偏好可随时调整，规则推荐会按新设置重新计算。</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {RISK_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setRiskPreference(option.value)} className={`rounded-xl border p-3 text-left transition-colors ${riskPreference === option.value ? "border-primary bg-primary/8" : "border-border-subtle hover:border-border"}`}><p className="text-sm font-semibold text-text">{option.label}</p><p className="mt-1 text-xs leading-5 text-text-tertiary">{option.description}</p></button>)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-text-secondary">保留现金比例<Input className="mt-1" inputMode="decimal" value={reserveCashRatio} onChange={(event) => setReserveCashRatio(event.target.value)} aria-label="保留现金比例" /></label>
        <label className="text-xs text-text-secondary">单一标的上限<Input className="mt-1" inputMode="decimal" value={maxInstrumentConcentration} onChange={(event) => setMaxInstrumentConcentration(event.target.value)} aria-label="单一标的上限" /></label>
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <div className="mt-4 flex justify-end"><Button size="sm" variant="outline" onClick={() => onSave({ riskPreference, reserveCashRatio, maxInstrumentConcentration })} disabled={isSaving}>{isSaving ? "保存中…" : "保存风险设置"}</Button></div>
    </Card>
  );
}
