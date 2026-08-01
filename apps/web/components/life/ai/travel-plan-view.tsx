import { motion } from "framer-motion";

import { TravelChecklist } from "@/components/life/ai/travel-checklist";
import { TravelPreparation } from "@/components/life/ai/travel-preparation";
import { TravelRouteCard } from "@/components/life/ai/travel-route-card";
import { TravelTips } from "@/components/life/ai/travel-tips";
import { Card } from "@/components/ui";
import type { TravelPlanResponse } from "@/lib/life";

export function TravelPlanView({ plan }: { plan: TravelPlanResponse }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="bg-gradient-to-br from-sky-500/10 to-emerald-500/10 p-5">
        <h1 className="text-xl font-bold">{plan.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.summary}</p>
        {plan.bestTime && (
          <p className="mt-3 rounded-[8px] bg-surface/70 px-3 py-2 text-[13px]">
            最佳时间：{plan.bestTime}
          </p>
        )}
      </Card>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">每日路线</h2>
        {plan.route.map((day) => (
          <TravelRouteCard key={day.day} day={day} />
        ))}
      </div>
      <TravelPreparation items={plan.preparation} />
      <TravelChecklist aiContentId={plan.aiContentId} />
      <TravelTips items={plan.tips} />
    </motion.div>
  );
}
