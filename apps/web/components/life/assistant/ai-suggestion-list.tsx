import { CheckCircle2, ListChecks } from "lucide-react";

import type { LifeAssistantResponse } from "@/lib/life";

export function AiSuggestionList({
  tasks,
  suggestions,
}: {
  tasks?: LifeAssistantResponse["todayTasks"];
  suggestions?: string[];
}) {
  const taskList = tasks || [];
  const suggestionList = suggestions || [];
  return (
    <div className="mt-4 space-y-4">
      {taskList.length > 0 && (
        <div>
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
      {suggestionList.length > 0 && (
        <div className="space-y-2">
          {suggestionList.map((suggestion, index) => (
            <p key={index} className="flex items-start gap-2 text-[13px] text-text/80">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              {suggestion}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
