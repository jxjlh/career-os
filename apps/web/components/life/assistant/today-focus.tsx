import { Sparkles } from "lucide-react";

import type { LifeAssistantResponse } from "@/lib/life";

export function TodayFocus({
  greeting,
  focusGoal,
}: {
  greeting?: string | null;
  focusGoal?: LifeAssistantResponse["focusGoal"] | null;
}) {
  const hasFocus = Boolean(focusGoal?.title);
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ai/10 text-ai">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{greeting || "早上好，今天继续成长吧"}</p>
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
  );
}
