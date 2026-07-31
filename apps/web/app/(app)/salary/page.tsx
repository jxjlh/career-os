"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function SalaryPage() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("200000");
  const [target, setTarget] = useState("500000");
  const [plan, setPlan] = useState<any>(null);

  const generate = useMutation({
    mutationFn: () =>
      apiFetch<Envelope>("/salary-plans/generate", {
        method: "POST",
        body: JSON.stringify({ currentSalary: Number(current), targetSalary: Number(target), horizonYears: 3 }),
      }),
    onSuccess: (res) => setPlan(res.data),
  });

  return (
    <div>
      <SectionHeader title={t("nav.salary")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("salary.assumptions")}</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">{t("salary.currentSalary")}</label>
              <Input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">{t("salary.targetSalary")}</label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => generate.mutate()} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("salary.generateCta")}
            </Button>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("salary.breakdown")}</h2>
          {plan ? (
            <div className="space-y-3">
              {(plan.breakdown.phases || []).map((phase: any, i: number) => (
                <div key={i} className="rounded-[8px] border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{phase.phase}</p>
                    <Badge variant="primary">{phase.timeline}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {t("salary.phaseSalary")
                      .replace("{salary}", (phase.targetSalary / 10000).toFixed(0))
                      .replace("{level}", phase.jobLevel)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {phase.skills.map((s: string) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">{t("salary.noPlan")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
