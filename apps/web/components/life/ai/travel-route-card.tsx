import type { TravelDay } from "@/lib/life";

export function TravelRouteCard({ day }: { day: TravelDay }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Day {day.day}</span>
        <p className="text-sm font-semibold">{day.title}</p>
      </div>
      <ul className="mt-2 space-y-1">
        {day.activities.map((activity, index) => (
          <li key={index} className="flex gap-2 text-[13px] text-muted">
            <span>•</span>
            {activity}
          </li>
        ))}
      </ul>
    </div>
  );
}
