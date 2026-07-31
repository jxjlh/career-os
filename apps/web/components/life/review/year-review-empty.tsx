import { Sparkles } from "lucide-react";

export function YearReviewEmpty() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-border bg-surface p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-ai/10 text-ai">
        <Sparkles className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold">生成你的年度人生报告，回顾这一年的成长。</p>
      <p className="max-w-sm text-[13px] text-muted">选择年份与风格，AI 会整理目标、任务、记录与经验值。</p>
    </div>
  );
}
