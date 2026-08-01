"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [currentTitle, setCurrentTitle] = useState("");
  const [company, setCompany] = useState("");
  const [experienceYears, setExperienceYears] = useState("1");
  const [targetTitle, setTargetTitle] = useState("");
  const [targetSalary, setTargetSalary] = useState("300000");
  const [weeklyMinutes, setWeeklyMinutes] = useState("420");
  const [selectedSkills, setSelectedSkills] = useState<Record<string, { current: number; target: number }>>({});

  const skills = useQuery<Envelope>({
    queryKey: ["skills-catalog"],
    queryFn: () => apiFetch("/skills"),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/onboarding", {
        method: "POST",
        body: JSON.stringify({
          current_title: currentTitle,
          target_title: targetTitle,
          target_salary: Number(targetSalary),
          experience_years: Number(experienceYears),
          weekly_study_minutes: Number(weeklyMinutes),
          language: "zh-CN",
          skills: Object.entries(selectedSkills).map(([skillId, levels]) => ({
            skillId,
            name: skills.data?.data.find((s: any) => s.skillId === skillId)?.name || skillId,
            currentLevel: levels.current,
            targetLevel: levels.target,
          })),
        }),
      }),
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
  });

  const steps = [t("onboarding.stepBasic"), t("onboarding.stepGoal"), t("onboarding.stepSkills"), t("onboarding.stepTime")];

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <BrandMark className="h-9 w-9" />
        <span className="text-sm font-bold tracking-tight">
          Career<span className="text-gradient">OS</span>
        </span>
      </div>
      <p className="mb-4 rounded-[10px] border border-border/70 bg-surface/60 p-3 text-[13px] leading-relaxed text-muted">
        {t("onboarding.optionalTip")}
      </p>
      <div className="mb-6 flex items-center gap-2">
        {steps.map((label, index) => (
          <div key={label} className="flex flex-1 flex-col gap-1">
            <div className={`h-1.5 rounded-full transition-colors ${index <= step ? "bg-gradient-to-r from-primary to-accent" : "bg-surface-muted"}`} />
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">{t("onboarding.first")}</h1>
            <Input placeholder={t("onboarding.currentTitlePh")} value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
            <Input placeholder={t("onboarding.companyPh")} value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input type="number" placeholder={t("onboarding.years")} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">{t("onboarding.goal")}</h1>
            <Input placeholder={t("onboarding.targetTitlePh")} value={targetTitle} onChange={(e) => setTargetTitle(e.target.value)} />
            <Input type="number" placeholder={t("onboarding.targetSalaryPh")} value={targetSalary} onChange={(e) => setTargetSalary(e.target.value)} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">{t("onboarding.skills")}</h1>
            <p className="text-[13px] text-muted">{t("onboarding.skillDesc")}</p>
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {(skills.data?.data || []).map((skill: any) => {
                const selected = selectedSkills[skill.skillId];
                return (
                  <div key={skill.skillId} className="rounded-[8px] border border-border p-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={(e) => {
                          setSelectedSkills((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[skill.skillId] = { current: 1, target: 5 };
                            else delete next[skill.skillId];
                            return next;
                          });
                        }}
                      />
                      {skill.name}
                    </label>
                    {selected && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <span>当前 {selected.current}</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={selected.current}
                          onChange={(e) =>
                            setSelectedSkills((prev) => ({
                              ...prev,
                              [skill.skillId]: { ...prev[skill.skillId], current: Number(e.target.value) },
                            }))
                          }
                          className="flex-1 accent-[var(--primary)]"
                        />
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={selected.target}
                          onChange={(e) =>
                            setSelectedSkills((prev) => ({
                              ...prev,
                              [skill.skillId]: { ...prev[skill.skillId], target: Number(e.target.value) },
                            }))
                          }
                          className="flex-1 accent-[var(--primary)]"
                        />
                        <span>目标 {selected.target}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <h1 className="text-lg font-semibold">{t("onboarding.time")}</h1>
            <Input type="number" placeholder={t("onboarding.weeklyPh")} value={weeklyMinutes} onChange={(e) => setWeeklyMinutes(e.target.value)} />
            <p className="rounded-[6px] bg-surface-muted p-3 text-[13px] text-muted">
              {t("onboarding.finishDesc")}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" />
            {t("onboarding.back")}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={step === 2 && Object.keys(selectedSkills).length === 0}>
              {t("onboarding.next")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || !targetTitle.trim()}>
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("onboarding.generate")}
              {submit.isSuccess && <Check className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </Card>
      <div className="mt-4 text-center">
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          {t("onboarding.skip")}
        </Button>
      </div>
    </div>
  );
}
