import { useEffect, useState } from "react";

import type { YearReviewStatistics } from "@/lib/life";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display}</span>;
}

export function YearReviewStatistics({ statistics }: { statistics: YearReviewStatistics }) {
  const items = [
    { icon: "🎯", label: "完成目标", value: statistics.goalsCompleted ?? statistics.goals_completed ?? 0 },
    { icon: "✅", label: "完成任务", value: statistics.tasksCompleted ?? statistics.tasks_completed ?? 0 },
    { icon: "📷", label: "人生记录", value: statistics.recordsCreated ?? statistics.records_created ?? 0 },
    { icon: "⚡", label: "获得 XP", value: statistics.xpGained ?? statistics.xp_gained ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-[10px] border border-border bg-surface p-3">
          <span className="text-lg">{item.icon}</span>
          <p className="mt-1.5 text-xl font-bold">
            <AnimatedNumber value={item.value} />
          </p>
          <p className="text-xs text-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
