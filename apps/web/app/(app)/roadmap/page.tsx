"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function RoadmapPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const roadmaps = useQuery<Envelope>({
    queryKey: ["roadmaps"],
    queryFn: () => apiFetch("/roadmaps"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/roadmaps", {
        method: "POST",
        body: JSON.stringify({ title: title || "我的职业路线", horizonYears: 5 }),
      }),
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
    },
  });

  const generate = useMutation({
    mutationFn: (id: string) => apiFetch(`/roadmaps/${id}/generate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roadmaps"] }),
  });

  return (
    <div>
      <SectionHeader
        title={t("roadmap.title")}
        subtitle="3 / 5 / 10 years"
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="路线名称" className="w-48" />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </form>
        }
      />

      <div className="space-y-4">
        {(roadmaps.data?.data || []).map((roadmap: any) => (
          <Card key={roadmap.id} className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{roadmap.title}</h2>
                <Badge variant={roadmap.status === "active" ? "success" : "default"}>{roadmap.horizonYears}y</Badge>
                <Badge>{roadmap.source}</Badge>
              </div>
              <Button size="sm" onClick={() => generate.mutate(roadmap.id)} disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t("roadmap.generate")}
              </Button>
            </div>
            <div className="relative space-y-4 pl-6">
              <div className="absolute bottom-4 left-[7px] top-4 w-px bg-border" />
              {(roadmap.milestones || []).map((m: any) => (
                <div key={m.id} className="relative">
                  <span
                    className={`absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${
                      m.status === "done" ? "bg-success text-white" : "bg-surface-muted text-muted"
                    }`}
                  >
                    {m.status === "done" ? <Check className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    {m.phase && <Badge variant={m.status === "done" ? "success" : m.status === "in_progress" ? "warning" : "default"}>{m.phase}</Badge>}
                  </div>
                  {m.description && <p className="mt-0.5 text-[13px] text-muted">{m.description}</p>}
                </div>
              ))}
              {(!roadmap.milestones || roadmap.milestones.length === 0) && (
                <p className="text-[13px] text-muted">点击“AI 生成路线”创建里程碑。</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
