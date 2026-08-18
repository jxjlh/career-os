"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { TravelChat } from "@/components/life/ai/travel-chat";
import { TravelPlanView } from "@/components/life/ai/travel-plan-view";
import { Button, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { TravelPlanResponse } from "@/lib/life";

type Envelope = { data: any };

export default function LifeGoalAiPage() {
  const searchParams = useSearchParams();
  const goalId = searchParams.get("goalId") ?? "";
  const goal = useQuery<Envelope>({
    queryKey: ["life-goal", goalId],
    queryFn: () => apiFetch(`/life/goals/${goalId}`),
    enabled: Boolean(goalId),
  });
  const [plan, setPlan] = useState<TravelPlanResponse | null>(null);

  if (goal.isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/life/goals/detail?id=${goalId}`} className="mb-4 inline-flex">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>

      {!plan && (
        <TravelChat
          goalId={goalId}
          onPlanGenerated={(result) => {
            setPlan(result);
            goal.refetch();
          }}
        />
      )}

      {plan && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPlan(null)}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新生成
            </Button>
          </div>
          <TravelPlanView plan={plan} />
        </div>
      )}
    </div>
  );
}
