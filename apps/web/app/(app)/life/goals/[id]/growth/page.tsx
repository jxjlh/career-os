"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { GrowthPlanForm } from "@/components/life/ai/growth-plan-form";
import { GrowthPlanView } from "@/components/life/ai/growth-plan-view";
import { Button, Card, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { generateGrowthPlan, type GrowthPlanResponse } from "@/lib/life";

type Envelope = { data: any };

export default function LifeGoalGrowthPage() {
  const params = useParams<{ id: string }>();
  const goalId = params.id;
  const goal = useQuery<Envelope>({
    queryKey: ["life-goal", goalId],
    queryFn: () => apiFetch(`/life/goals/${goalId}`),
  });
  const [plan, setPlan] = useState<GrowthPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (goal.isLoading) return <Skeleton className="h-64" />;

  const generate = async (input: {
    targetDescription: string;
    currentStatus: string;
    availableTime: string;
    difficulty: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateGrowthPlan({
        goalId,
        ...input,
      });
      setPlan(result);
    } catch {
      setError("AI 生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/life/goals/${goalId}`} className="mb-4 inline-flex">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>

      {loading && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">AI 正在设计你的成长路线...</p>
        </Card>
      )}

      {!loading && !plan && (
        <GrowthPlanForm
          defaultTarget={goal.data?.data?.title || ""}
          onGenerate={generate}
          loading={loading}
        />
      )}

      {!loading && plan && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPlan(null)}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新生成
            </Button>
          </div>
          <GrowthPlanView plan={plan} />
        </div>
      )}

      {error && !loading && !plan && (
        <Card className="mt-4 flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button onClick={() => setError(null)}>返回重试</Button>
        </Card>
      )}
    </div>
  );
}
