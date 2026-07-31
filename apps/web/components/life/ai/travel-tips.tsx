import { Lightbulb } from "lucide-react";

export function TravelTips({ items }: { items: string[] }) {
  return (
    <div className="rounded-[12px] border border-border bg-gradient-to-br from-amber-400/10 to-orange-500/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="h-4 w-4 text-warning" />
        旅行 Tips
      </p>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-[13px] text-muted">
            <span>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
