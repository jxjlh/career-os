import { TrendingUp } from "lucide-react";

export function ProgressSummary({
  progress,
}: {
  progress?: { completedTasks: number; totalTasks: number; level: number; xp: number };
}) {
  const data = progress || { completedTasks: 0, totalTasks: 0, level: 1, xp: 0 };
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[13px] text-muted">
      <span className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        任务进度 {data.completedTasks}/{data.totalTasks}
      </span>
      <span>
        Lv.{data.level} · {data.xp} XP
      </span>
    </div>
  );
}
