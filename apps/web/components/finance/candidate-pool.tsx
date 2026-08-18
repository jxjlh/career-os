"use client";

import { Archive, Eye, FlaskConical } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import type { FinanceCandidate } from "@/lib/finance";

const STATUS: Record<FinanceCandidate["researchStatus"], { label: string; variant: "default" | "primary" | "success" | "warning" }> = {
  watching: { label: "观察", variant: "default" }, researching: { label: "研究中", variant: "warning" }, ready: { label: "可纳入规则", variant: "success" }, archived: { label: "已归档", variant: "default" },
};

export function CandidatePool({ candidates, onArchive, isUpdating = false, error }: { candidates: FinanceCandidate[]; onArchive: (candidate: FinanceCandidate) => void; isUpdating?: boolean; error?: string | null }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-text">候选池</p><p className="mt-1 text-xs text-text-tertiary">只有标记为“可纳入规则”的候选会进入买入时机评估。</p></div><FlaskConical className="h-4 w-4 text-primary" /></div>
      {candidates.length === 0 ? <div className="mt-4"><EmptyState title="候选池为空" description="可先从手工维护或后续搜索结果中加入候选标的。" /></div> : <div className="mt-4 space-y-3">{candidates.map((candidate) => { const status = STATUS[candidate.researchStatus]; return <div key={candidate.id} className="rounded-xl border border-border-subtle p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-text">标的 ID · {candidate.instrumentId.slice(0, 8)}</p><p className="mt-1 text-xs leading-5 text-text-secondary">{candidate.suitabilityReason || "尚未补充适配理由。"}</p></div><Badge variant={status.variant}>{status.label}</Badge></div><div className="mt-3 flex items-center justify-between"><span className="inline-flex items-center gap-1 text-xs text-text-tertiary"><Eye className="h-3.5 w-3.5" />{candidate.alertEligible ? "允许规则提醒" : "不接收提醒"}</span>{candidate.researchStatus !== "archived" && <Button variant="ghost" size="sm" disabled={isUpdating} onClick={() => onArchive(candidate)}><Archive className="h-3.5 w-3.5" />归档</Button>}</div></div>; })}</div>}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Card>
  );
}
