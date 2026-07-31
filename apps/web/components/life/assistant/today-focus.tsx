import { ListChecks, Sparkles } from "lucide-react";

import type { LifeAssistantResponse } from "@/lib/life";

export function TodayFocus({
  greeting,
  focusGoal,
  tasks,
}: {
  greeting?: string | null;
  focusGoal?: LifeAssistantResponse["focusGoal"] | null;
  tasks?: LifeAssistantResponse["todayTasks"];
}) {
  const hasFocus = Boolean(focusGoal?.title);
  const taskList = tasks || [];
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ai/10 text-ai">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-muted">今日重点</p>
          <p className="mt-0.5 text-sm font-semibold">{greeting || "早上好，今天继续成长吧"}</p>
          {hasFocus ? (
            <>
              <p className="mt-1 text-[13px] text-muted">
                {focusGoal?.title} · {focusGoal?.progress || "0%"}
              </p>
              {focusGoal?.reason && <p className="mt-1 text-[13px] text-text/70">{focusGoal.reason}</p>}
            </>
          ) : (
            <p className="mt-1 text-[13px] text-muted">创建一个人生目标，让 AI 为你规划今天。</p>
          )}
        </div>
      </div>
      {taskList.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <ListChecks className="h-3.5 w-3.5" />
            今日任务
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {taskList.map((task) => (
              <span
                key={task.id}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium"
              >
                {task.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
