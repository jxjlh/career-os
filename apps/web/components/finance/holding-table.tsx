"use client";

import { Plus } from "lucide-react";

import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { displayMoney, type FinanceHolding } from "@/lib/finance";

export function HoldingTable({ holdings, onAddTransaction }: { holdings: FinanceHolding[]; onAddTransaction: (holding?: FinanceHolding) => void }) {
  if (holdings.length === 0) {
    return <EmptyState title="还没有持仓" description="添加一笔手工交易，或上传持仓截图进行识别和确认。" action={<Button size="sm" onClick={() => onAddTransaction()}><Plus className="h-3.5 w-3.5" />手工记账</Button>} />;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-muted/50 text-xs text-text-tertiary">
            <tr>
              <th className="px-4 py-3 font-medium">标的</th><th className="px-4 py-3 font-medium">账户</th><th className="px-4 py-3 text-right font-medium">持有份额</th><th className="px-4 py-3 text-right font-medium">成本</th><th className="px-4 py-3 text-right font-medium">市值</th><th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {holdings.map((holding) => (
              <tr key={holding.id} className="hover:bg-surface-muted/35">
                <td className="px-4 py-3"><p className="font-medium text-text">{holding.instrument.name}</p><p className="mt-0.5 text-xs text-text-tertiary">{holding.instrument.symbol} · {holding.instrument.market}</p></td>
                <td className="px-4 py-3 text-text-secondary">{holding.accountName}</td>
                <td className="px-4 py-3 text-right font-medium text-text">{holding.quantity}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{displayMoney(holding.costBasis, holding.currency)}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{displayMoney(holding.marketValue, holding.currency)}</td>
                <td className="px-4 py-3"><Badge variant={holding.marketValue === null ? "warning" : "success"}>{holding.marketValue === null ? "待行情" : "已估值"}</Badge></td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onAddTransaction(holding)}>记一笔</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
