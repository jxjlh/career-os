import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui";

export function YearReviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-border bg-gradient-to-br from-ai/10 to-blue-500/10 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-ai">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI 正在分析你的人生轨迹...
        </div>
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-56" />
    </div>
  );
}
