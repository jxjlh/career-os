import type { GrowthDay } from "@/lib/life";

export function GrowthDailyPlan({ days }: { days: GrowthDay[] }) {
  return (
    <div className="space-y-2">
      {days.map((day) => (
        <div key={day.day} className="rounded-[12px] border border-border bg-surface p-3">
          <p className="text-xs font-semibold text-primary">Day {day.day}</p>
          <ul className="mt-1 space-y-1">
            {day.tasks.map((task, index) => (
              <li key={index} className="flex gap-2 text-[13px] text-muted">
                <span>•</span>
                {task}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
