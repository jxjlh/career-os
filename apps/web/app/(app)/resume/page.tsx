"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function ResumePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const resumes = useQuery<Envelope>({
    queryKey: ["resumes"],
    queryFn: () => apiFetch("/resumes"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/resumes", {
        method: "POST",
        body: JSON.stringify({ title: title || "我的简历", language: "zh" }),
      }),
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  const generate = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/resumes/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({ language: "zh" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resumes"] }),
  });

  const exportResume = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/resumes/${id}/export`, {
        method: "POST",
        body: JSON.stringify({ format: "pdf" }),
      }),
  });

  return (
    <div>
      <SectionHeader
        title={t("nav.resume")}
        action={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("resume.namePh")} className="w-44" />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </form>
        }
      />
      <div className="space-y-2">
        {(resumes.data?.data || []).map((resume: any) => (
          <Card key={resume.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{resume.title}</p>
              <p className="text-[13px] text-muted">
                {t("resume.version")} {resume.version} · {resume.language === "zh" ? "中文" : "English"}
              </p>
              {resume.sections?.summary && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{resume.sections.summary}</p>}
            </div>
            <Badge>{resume.status}</Badge>
            <Button size="sm" variant="outline" onClick={() => generate.mutate(resume.id)} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("resume.generate")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportResume.mutate(resume.id)} disabled={exportResume.isPending}>
              {exportResume.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("resume.exportPdf")}
            </Button>
          </Card>
        ))}
        {(!resumes.data?.data || resumes.data.data.length === 0) && (
          <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
            {t("resume.noResumes")}
          </p>
        )}
      </div>
    </div>
  );
}
