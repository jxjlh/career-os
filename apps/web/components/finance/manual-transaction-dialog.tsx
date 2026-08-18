"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Textarea } from "@/components/ui";
import type { FinanceAccount, FinanceHolding, FinanceMarket, FinanceAssetClass, TransactionCreate, TransactionType } from "@/lib/finance";

type FormState = {
  accountId: string;
  transactionType: TransactionType;
  name: string;
  symbol: string;
  assetClass: FinanceAssetClass;
  quantity: string;
  unitPrice: string;
  fee: string;
  occurredOn: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const makeReference = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? `manual-${crypto.randomUUID()}` : `manual-${Date.now()}`;

export function ManualTransactionDialog({ open, accounts, holding, onClose, onSubmit, isSubmitting, error }: { open: boolean; accounts: FinanceAccount[]; holding?: FinanceHolding | null; onClose: () => void; onSubmit: (payload: TransactionCreate) => void; isSubmitting?: boolean; error?: string | null }) {
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === (holding?.accountId || "")) || accounts[0], [accounts, holding?.accountId]);
  const [form, setForm] = useState<FormState>({ accountId: "", transactionType: "buy", name: "", symbol: "", assetClass: "fund", quantity: "", unitPrice: "", fee: "0", occurredOn: today(), notes: "" });

  useEffect(() => {
    if (!open) return;
    setForm({
      accountId: holding?.accountId || selectedAccount?.id || "",
      transactionType: "buy",
      name: holding?.instrument.name || "",
      symbol: holding?.instrument.symbol || "",
      assetClass: holding?.instrument.assetClass || "fund",
      quantity: "",
      unitPrice: holding?.marketPrice || holding?.averageCost || "",
      fee: "0",
      occurredOn: today(),
      notes: "",
    });
  }, [holding, open, selectedAccount?.id]);

  if (!open) return null;
  const account = accounts.find((item) => item.id === form.accountId);
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!account) return;
    const market = (holding?.instrument.market || account.market) as FinanceMarket;
    onSubmit({
      accountId: form.accountId,
      instrumentId: holding?.instrumentId,
      instrument: holding ? undefined : { market, symbol: form.symbol.trim(), name: form.name.trim(), assetClass: form.assetClass, currency: account.currency },
      transactionType: form.transactionType,
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      fee: form.fee || "0",
      currency: account.currency,
      occurredOn: form.occurredOn,
      notes: form.notes.trim() || undefined,
      clientReference: makeReference(),
    });
  };
  const valid = Boolean(account && form.quantity && form.unitPrice && (holding || (form.name.trim() && form.symbol.trim())));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="手工记账" onMouseDown={onClose}>
      <Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-text">手工记账</h2><p className="mt-1 text-xs text-text-tertiary">交易会按发生日期重算对应持仓，不会改变历史记录。</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭"><X className="h-4 w-4" /></Button></div>
        {accounts.length === 0 ? <p className="mt-5 rounded-lg bg-surface-muted p-3 text-sm text-text-secondary">正在准备你的默认投资账户，请稍后重试。</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-text-secondary">账户<select className="mt-1 h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm text-text" value={form.accountId} onChange={(event) => set("accountId", event.target.value)}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}</select></label>
          <label className="text-xs text-text-secondary">交易类型<select className="mt-1 h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm text-text" value={form.transactionType} onChange={(event) => set("transactionType", event.target.value)}><option value="buy">买入</option><option value="sell">卖出</option><option value="dividend">分红</option><option value="fee">费用</option></select></label>
          <label className="text-xs text-text-secondary">标的名称<Input className="mt-1" value={form.name} disabled={Boolean(holding)} onChange={(event) => set("name", event.target.value)} placeholder="例如：沪深 300 ETF" /></label>
          <label className="text-xs text-text-secondary">代码<Input className="mt-1" value={form.symbol} disabled={Boolean(holding)} onChange={(event) => set("symbol", event.target.value)} placeholder="例如：510300" /></label>
          {!holding && <label className="text-xs text-text-secondary">资产类型<select className="mt-1 h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm text-text" value={form.assetClass} onChange={(event) => set("assetClass", event.target.value)}><option value="fund">基金</option><option value="etf">ETF</option><option value="stock">股票</option></select></label>}
          <label className="text-xs text-text-secondary">份额<Input className="mt-1" inputMode="decimal" value={form.quantity} onChange={(event) => set("quantity", event.target.value)} placeholder="0.00" /></label>
          <label className="text-xs text-text-secondary">成交单价<Input className="mt-1" inputMode="decimal" value={form.unitPrice} onChange={(event) => set("unitPrice", event.target.value)} placeholder="0.00" /></label>
          <label className="text-xs text-text-secondary">手续费<Input className="mt-1" inputMode="decimal" value={form.fee} onChange={(event) => set("fee", event.target.value)} placeholder="0" /></label>
          <label className="text-xs text-text-secondary">发生日期<Input className="mt-1" type="date" value={form.occurredOn} onChange={(event) => set("occurredOn", event.target.value)} /></label>
          <label className="text-xs text-text-secondary sm:col-span-2">备注<Textarea className="mt-1" value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="可选" /></label>
        </div>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" onClick={submit} disabled={!valid || isSubmitting}>{isSubmitting ? "保存中…" : "保存交易"}</Button></div>
      </Card>
    </div>
  );
}
