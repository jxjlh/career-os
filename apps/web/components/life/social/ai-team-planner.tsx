"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CalendarDays, Flag, Sparkles, Users } from "lucide-react";

import { Avatar, Button, Skeleton } from "@/components/life/social/ui-extras";
import { generateTeamPlan, listSharedMembers, type TeamPlanResponse } from "@/lib/social";

/**
 * AI 团队规划: 为共同目标生成任务分工 / 里程碑 / 风险提示.
 * 仅展示当前已加入的共同目标.
 */
export function AiTeamPlanner({ sharedGoalId }: { sharedGoalId: string }) {
  const membersQuery = useQuery({
    queryKey: ["social-shared-members", sharedGoalId],
    queryFn: () => listSharedMembers(sharedGoalId),
  });

  const plan = useMutation({
    mutationFn: () => generateTeamPlan({ sharedGoalId }),
  });

  const response = plan.data;
  const members = membersQuery.data ?? [];

  return (
    <section className="rounded-[14px] border border-ai/30 bg-gradient-to-br from-ai/5 to-transparent p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <h3 className="text-sm font-semibold">AI 团队规划</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-ai/40 text-ai hover:bg-ai/10"
          onClick={() => plan.mutate()}
          disabled={plan.isPending || members.length === 0}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {plan.isPending ? "规划中…" : response ? "重新规划" : "生成规划"}
        </Button>
      </div>

      {members.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted" />
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((m) => (
              <Avatar
                key={m.profile.id}
                name={m.profile.displayName}
                avatarUrl={m.profile.avatarUrl}
                size={28}
              />
            ))}
          </div>
          <span className="text-xs text-muted">{members.length} 位伙伴</span>
        </div>
      )}

      {plan.isPending && (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      <AnimatePresence>
        {response && !plan.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {response.source === "fallback" && (
              <p className="text-xs text-muted">⚠️ 基础规划模板, 试试再次生成获取 AI 建议。</p>
            )}

            <PlanTasks plan={response} members={members} />
            <PlanTimeline timeline={response.timeline} />
            <PlanRisks risks={response.risks} />

            {response.collaborationTip && (
              <div className="rounded-[10px] bg-primary/5 p-3">
                <p className="text-xs leading-relaxed text-text">
                  💡 {response.collaborationTip}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function PlanTasks({
  plan,
  members,
}: {
  plan: TeamPlanResponse;
  members: { profile: { id: string; displayName: string; avatarUrl?: string | null } }[];
}) {
  if (plan.tasks.length === 0) return null;
  const findName = (id: string) =>
    members.find((m) => m.profile.id === id)?.profile.displayName ?? "待分配";
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">任务分工</p>
      <div className="space-y-2">
        {plan.tasks.map((task, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 rounded-[10px] border border-border bg-surface p-3"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>👤 {findName(task.assignee)}</span>
                <span>·</span>
                <span>⏱️ {task.estimatedDays} 天</span>
                {task.startAt && (
                  <>
                    <span>·</span>
                    <span>📅 {task.startAt}</span>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PlanTimeline({
  timeline,
}: {
  timeline: TeamPlanResponse["timeline"];
}) {
  if (timeline.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <CalendarDays className="h-3 w-3" />
        里程碑
      </p>
      <div className="flex flex-wrap gap-2">
        {timeline.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs"
          >
            <Flag className="h-3 w-3 text-primary" />
            <span className="font-medium">{m.milestone}</span>
            {m.targetDate && <span className="text-muted">{m.targetDate}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanRisks({ risks }: { risks: TeamPlanResponse["risks"] }) {
  if (risks.length === 0) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <AlertTriangle className="h-3 w-3" />
        风险提示
      </p>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className="rounded-[10px] bg-warning/5 p-3">
            <p className="text-xs font-medium text-warning">⚠️ {r.risk}</p>
            <p className="mt-1 text-xs text-muted">{r.mitigation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
