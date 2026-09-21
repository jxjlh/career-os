"use client";

import { motion } from "framer-motion";
import { CalendarDays, Flag, Lightbulb, Target } from "lucide-react";

import { Card } from "@/components/ui";
import type { GrowthPlanResponse } from "@/lib/life";

/** 规划在各分类下的称呼：健康类不叫「成长计划」，理财类不叫「学习路径」。 */
export const PLAN_LABELS: Record<string, string> = {
  career: "职业规划",
  skill: "学习路径",
  health: "健康计划",
  finance: "理财规划",
  relationship: "相处计划",
  other: "AI 规划",
};

export function getPlanLabel(category?: string | null): string {
  return PLAN_LABELS[category || "other"] ?? "AI 规划";
}

/** 展示一份已保存的规划：阶段 → 里程碑 → 逐日安排（折叠）→ 建议。 */
export function LifePlanView({ plan }: { plan: GrowthPlanResponse }) {
  const label = getPlanLabel(plan.category);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="bg-gradient-to-br from-slate-500/10 to-slate-400/5 p-5">
        <p className="text-[12px] font-medium text-ai">{label}</p>
        <h1 className="mt-1 text-xl font-bold">{plan.title || "你的专属规划"}</h1>
        {plan.summary && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{plan.summary}</p>
        )}
      </Card>

      {plan.phases.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">阶段安排</h2>
          {plan.phases.map((phase, index) => (
            <div key={index} className="rounded-[12px] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  阶段 {index + 1}
                </span>
                <p className="text-sm font-semibold">{phase.name}</p>
                {phase.days && <span className="text-xs text-muted">{phase.days}</span>}
              </div>
              {(phase.tasks || []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(phase.tasks || []).map((task, taskIndex) => (
                    <li key={taskIndex} className="flex gap-2 text-[13px] text-muted">
                      <span>•</span>
                      {task}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {plan.milestones.length > 0 && (
        <div className="rounded-[12px] border border-border bg-gradient-to-br from-emerald-400/10 to-teal-500/10 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Flag className="h-4 w-4 text-success" />
            里程碑
          </p>
          <ul className="space-y-2">
            {plan.milestones.map((milestone, index) => (
              <li key={index} className="flex gap-2 text-[13px] text-muted">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {milestone}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.dailyPlan.length > 0 && (
        <details className="rounded-[12px] border border-border bg-surface p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted" />
            前 {plan.dailyPlan.length} 天逐日安排
          </summary>
          <div className="mt-3 space-y-3">
            {plan.dailyPlan.map((day, index) => (
              <div key={index}>
                <p className="text-[13px] font-medium">第 {day.day ?? index + 1} 天</p>
                <ul className="mt-1 space-y-1">
                  {(day.tasks || []).map((task, taskIndex) => (
                    <li key={taskIndex} className="flex gap-2 text-[13px] text-muted">
                      <span>•</span>
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {plan.tips.length > 0 && (
        <div className="rounded-[12px] border border-border bg-gradient-to-br from-amber-400/10 to-orange-500/10 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-warning" />
            给你的建议
          </p>
          <ul className="space-y-2">
            {plan.tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-[13px] text-muted">
                <span>•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
