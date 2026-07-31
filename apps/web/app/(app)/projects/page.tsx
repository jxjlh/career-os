"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function ProjectsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const projects = useQuery<Envelope>({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/projects"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <div>
      <SectionHeader
        title={t("nav.projects")}
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) create.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("projects.titlePh")} className="w-56" />
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </form>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(projects.data?.data || []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <p className="truncate text-sm font-medium">{p.title}</p>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.description || t("projects.noDesc")}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{p.status}</span>
              {p.role && <span className="text-xs text-muted">{p.role}</span>}
            </div>
          </Card>
        ))}
      </div>
      {(!projects.data?.data || projects.data.data.length === 0) && (
        <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
          {t("projects.noProjects")}
        </p>
      )}
    </div>
  );
}
