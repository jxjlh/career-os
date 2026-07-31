"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function JobsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const jobs = useQuery<Envelope>({
    queryKey: ["jobs"],
    queryFn: () => apiFetch("/jobs"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({ title, company }),
      }),
    onSuccess: () => {
      setTitle("");
      setCompany("");
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  return (
    <div>
      <SectionHeader
        title={t("nav.jobs")}
        action={
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) create.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("jobs.titlePh")} className="w-52" />
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("jobs.companyPh")} className="w-44" />
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </form>
        }
      />
      <div className="space-y-2">
        {(jobs.data?.data || []).map((j: any) => (
          <Card key={j.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{j.title}</p>
              <p className="text-[13px] text-muted">
                {j.company} · {j.location || "Remote"}
              </p>
            </div>
            {j.salaryMin && j.salaryMax && (
              <span className="text-sm font-medium">
                {j.salaryMin / 10000}w - {j.salaryMax / 10000}w
              </span>
            )}
            <Badge>{j.status}</Badge>
            {j.matchScore != null && <Badge variant="primary">Match {j.matchScore}%</Badge>}
          </Card>
        ))}
      </div>
      {(!jobs.data?.data || jobs.data.data.length === 0) && (
        <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
          {t("jobs.noJobs")}
        </p>
      )}
    </div>
  );
}
