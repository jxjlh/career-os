import { Check } from "lucide-react";

export function TravelPreparation({ items }: { items: string[] }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold">准备清单</p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <label key={index} className="flex items-center gap-2 text-[13px]">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] border border-border bg-surface-muted">
              <Check className="h-3 w-3 opacity-0" />
            </span>
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}
