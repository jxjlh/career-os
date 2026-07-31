"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";

export function GrowthPlanForm({
  defaultTarget,
  onGenerate,
  loading,
}: {
  defaultTarget: string;
  onGenerate: (input: {
    targetDescription: string;
    currentStatus: string;
    availableTime: string;
    difficulty: string;
  }) => void;
  loading: boolean;
}) {
  const [targetDescription, setTargetDescription] = useState(defaultTarget);
  const [currentStatus, setCurrentStatus] = useState("");
  const [availableTime, setAvailableTime] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  return (
    <Card className="p-5">
      <h1 className="text-lg font-semibold">AI 成长教练</h1>
      <p className="mt-1 text-[13px] text-muted">告诉 AI 你的目标与现状，生成 30 天成长计划。</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted">目标描述</label>
          <Input value={targetDescription} onChange={(e) => setTargetDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">当前状态（可选）</label>
          <Input value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)} placeholder="如：销售新人" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">每日可投入时间（可选）</label>
          <Input value={availableTime} onChange={(e) => setAvailableTime(e.target.value)} placeholder="如：每天2小时" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">难度</label>
          <div className="flex gap-2">
            {["beginner", "medium", "advanced"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDifficulty(item)}
                className={`flex-1 rounded-[6px] border px-3 py-2 text-xs ${
                  difficulty === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          disabled={loading || !targetDescription.trim()}
          onClick={() =>
            onGenerate({
              targetDescription: targetDescription.trim(),
              currentStatus,
              availableTime,
              difficulty,
            })
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "AI 正在设计..." : "🤖 生成成长计划"}
        </Button>
      </div>
    </Card>
  );
}
