import { motion } from "framer-motion";
import { TrendingUp, Trophy } from "lucide-react";

export function AssistantProgress({
  progress,
}: {
  progress?: { completedTasks: number; totalTasks: number; level: number; xp: number };
}) {
  const data = progress || { completedTasks: 0, totalTasks: 0, level: 1, xp: 0 };
  const taskRate =
    data.totalTasks > 0 ? Math.min(100, Math.round((data.completedTasks * 100) / data.totalTasks)) : 0;

  return (
    <div className="mt-4 rounded-[10px] bg-surface/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-warning" />
          Lv.{data.level}
        </span>
        <span>{data.xp} XP</span>
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          任务 {data.completedTasks}/{data.totalTasks}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${taskRate}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
