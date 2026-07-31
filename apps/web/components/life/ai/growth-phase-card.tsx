import type { GrowthPhase } from "@/lib/life";

export function GrowthPhaseCard({ phase }: { phase: GrowthPhase }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{phase.name}</p>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{phase.days}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {phase.tasks.map((task, index) => (
          <li key={index} className="flex gap-2 text-[13px] text-muted">
            <span>•</span>
            {task}
          </li>
        ))}
      </ul>
    </div>
  );
}
