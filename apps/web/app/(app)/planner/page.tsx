"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";

import { Badge, Button, Card, SectionHeader, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function PlannerPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const plan = useQuery<Envelope>({
    queryKey: ["planner-current"],
    queryFn: () => apiFetch("/planner/current"),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiFetch("/planner/generate", {
        method: "POST",
        body: JSON.stringify({ weeklyStudyMinutes: 420 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const tasks = plan.data?.data.tasks || [];

  return (
    <div>
      <SectionHeader
        title={t("planner.title")}
        subtitle={plan.data?.data.weekStart || ""}
        action={
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("planner.generate")}
          </Button>
        }
      />
      {plan.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
            const dayTasks = tasks.filter((task: any) => task.day === day);
            return (
              <Card key={day} className="min-h-[220px] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-medium">{(t("planner.days") as unknown as string[])[day - 1]}</p>
                  <Badge>{dayTasks.length}</Badge>
                </div>
                <div className="space-y-2">
                  {dayTasks.map((task: any) => (
                    <div key={task.id} className="rounded-[6px] border border-border p-2">
                      <p className="text-[13px] leading-snug">{task.title}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs text-muted">
                          {task.estimatedMinutes} {t("planner.minutes")}
                        </span>
                        {task.status === "done" ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted">
                            <Plus className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
