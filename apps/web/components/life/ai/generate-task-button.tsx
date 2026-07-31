"use client";

import { Check, Loader2, Rocket } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui";
import { generateGrowthTasks } from "@/lib/life";

export function GenerateTaskButton({ aiContentId }: { aiContentId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateGrowthTasks(aiContentId);
      setMessage(`已创建 ${result.createdCount} 个成长任务`);
    } catch {
      setError("任务生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {loading ? "正在生成任务..." : "🚀 生成我的30天任务"}
      </Button>
      {message && (
        <p className="flex items-center gap-1 text-[13px] text-success">
          <Check className="h-4 w-4" />
          {message}
        </p>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
