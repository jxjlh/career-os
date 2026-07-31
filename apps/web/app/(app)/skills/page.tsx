"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";

import { EChart } from "@/components/chart";
import { Button, Card, SectionHeader, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

function SkillRow({
  skill,
  onSave,
}: {
  skill: any;
  onSave: (id: string, current: number, target: number) => void;
}) {
  const [current, setCurrent] = useState(skill.currentLevel || 1);
  const [target, setTarget] = useState(skill.targetLevel || 5);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[8px] border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{skill.name}</p>
        <p className="text-xs text-muted">{skill.category}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 text-right text-xs font-medium text-muted">{current}</span>
        <input
          type="range"
          min={1}
          max={10}
          value={current}
          onChange={(e) => setCurrent(Number(e.target.value))}
          className="w-24 accent-[var(--primary)]"
        />
        <span className="text-xs text-muted">→</span>
        <input
          type="range"
          min={1}
          max={10}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="w-24 accent-[var(--primary)]"
        />
        <span className="w-5 text-xs font-medium text-primary">{target}</span>
        <Button size="sm" onClick={() => onSave(skill.skillId, current, target)}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const matrix = useQuery<Envelope>({
    queryKey: ["skill-matrix"],
    queryFn: () => apiFetch("/skills/matrix"),
  });

  const update = useMutation({
    mutationFn: ({ id, current, target }: { id: string; current: number; target: number }) =>
      apiFetch(`/skills/${id}/progress`, {
        method: "PUT",
        body: JSON.stringify({ currentLevel: current, targetLevel: target, confidence: 0 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skill-matrix"] }),
  });

  const items = matrix.data?.data.items || [];
  const radarOption = {
    tooltip: {},
    radar: {
      indicator: items.slice(0, 6).map((s: any) => ({ name: s.name, max: 10 })),
      radius: "65%",
      splitArea: { areaStyle: { color: ["var(--surface)", "var(--surface-muted)"] } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: items.slice(0, 6).map((s: any) => s.currentLevel || 0),
            name: t("skills.current"),
            areaStyle: { opacity: 0.15 },
            lineStyle: { color: "#2563EB" },
          },
          {
            value: items.slice(0, 6).map((s: any) => s.targetLevel || 0),
            name: t("skills.target"),
            lineStyle: { color: "#16A34A" },
          },
        ],
      },
    ],
    legend: { bottom: 0, textStyle: { color: "var(--muted)" } },
  };

  return (
    <div>
      <SectionHeader title={t("skills.title")} subtitle={`${items.length} skills`} />
      <Card className="mb-4 p-4">
        {matrix.isLoading ? <Skeleton className="h-[280px]" /> : <EChart option={radarOption} height={280} />}
      </Card>
      <div className="space-y-2">
        {items.map((skill: any) => (
          <SkillRow
            key={skill.skillId}
            skill={skill}
            onSave={(id, current, target) => update.mutate({ id, current, target })}
          />
        ))}
      </div>
    </div>
  );
}
