import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";

import { TravelChecklist } from "@/components/life/ai/travel-checklist";
import { TravelPreparation } from "@/components/life/ai/travel-preparation";
import { TravelRouteCard } from "@/components/life/ai/travel-route-card";
import { TravelTips } from "@/components/life/ai/travel-tips";
import { Button, Card } from "@/components/ui";
import { updateTravelPlan, type TravelPlanResponse, type TravelPlanUpdateRequest } from "@/lib/life";
import { TravelPlanEditForm } from "@/components/life/ai/travel-plan-edit-form";

export function TravelPlanView({
  plan,
  editable = true,
  onSaved,
}: {
  plan: TravelPlanResponse;
  /** 是否允许人工编辑（详情页与生成页都默认开启） */
  editable?: boolean;
  /** 保存成功后回调，父组件据此刷新（如重新拉取 latest） */
  onSaved?: (plan: TravelPlanResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (payload: TravelPlanUpdateRequest) => {
    setSaving(true);
    setError(null);
    try {
      const next = await updateTravelPlan(plan.aiContentId, payload);
      setEditing(false);
      onSaved?.(next);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <TravelPlanEditForm
        plan={plan}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        saving={saving}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {editable && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={saving}>
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Button>
        </div>
      )}
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
      {error && <p className="text-xs text-danger">{error}</p>}
    </motion.div>
  );
}
