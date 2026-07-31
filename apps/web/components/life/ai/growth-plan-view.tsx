"use client";

import { motion } from "framer-motion";

import { GenerateTaskButton } from "@/components/life/ai/generate-task-button";
import { GrowthDailyPlan } from "@/components/life/ai/growth-daily-plan";
import { GrowthPhaseCard } from "@/components/life/ai/growth-phase-card";
import { Card } from "@/components/ui";
import type { GrowthPlanResponse } from "@/lib/life";

export function GrowthPlanView({ plan }: { plan: GrowthPlanResponse }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-5">
        <h1 className="text-xl font-bold">{plan.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.summary}</p>
      </Card>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">成长阶段</h2>
        {plan.phases.map((phase, index) => (
          <GrowthPhaseCard key={index} phase={phase} />
        ))}
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">每日计划</h2>
        <GrowthDailyPlan days={plan.dailyPlan} />
      </div>
      {plan.milestones.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">里程碑</p>
          <ul className="space-y-1">
            {plan.milestones.map((item, index) => (
              <li key={index} className="flex gap-2 text-[13px] text-muted">
                <span>🏁</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {plan.tips.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-400/10 to-orange-500/10 p-4">
          <p className="mb-2 text-sm font-semibold">成长建议</p>
          <ul className="space-y-1">
            {plan.tips.map((item, index) => (
              <li key={index} className="flex gap-2 text-[13px] text-muted">
                <span>💡</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <GenerateTaskButton aiContentId={plan.aiContentId} />
    </motion.div>
  );
}
