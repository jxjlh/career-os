"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card, Textarea } from "@/components/ui";
import { generateTravelPlan, type TravelPlanResponse } from "@/lib/life";

const STARTERS = [
  "我想去大理 7 天，预算 5000，喜欢美食和徒步，不想太赶",
  "想去日本看樱花，一家三口，预算 3 万，想轻松一点",
  "带爸妈去海边，5 天，节奏慢一点，少走路",
];

export function TravelRequirementForm({
  goalId,
  onPlanGenerated,
}: {
  goalId?: string;
  onPlanGenerated: (plan: TravelPlanResponse) => void;
}) {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    const text = requirement.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const plan = await generateTravelPlan({ goalId, requirement: text });
      onPlanGenerated(plan);
    } catch {
      setError("AI 暂时没有响应，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-ai" />
        <h1 className="text-base font-semibold">AI 旅行攻略</h1>
      </div>
      <p className="mb-3 text-[13px] text-muted">
        一句话写下你的旅行需求，AI 直接生成完整攻略，并保存到这个目标下。
      </p>

      <Textarea
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        placeholder="例如：我想去大理 7 天，预算 5000，喜欢美食和徒步，不想太赶"
        rows={4}
        disabled={loading}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => setRequirement(starter)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-primary/40 hover:text-text"
          >
            {starter}
          </button>
        ))}
      </div>

      <Button
        className="mt-4 w-full"
        variant="primary"
        disabled={loading || !requirement.trim()}
        onClick={() => void generate()}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "AI 正在规划..." : "🤖 生成旅行攻略"}
      </Button>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}
