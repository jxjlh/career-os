"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Briefcase,
  CalendarDays,
  Clock,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";

import { EChart } from "@/components/chart";
import { Badge, Button, Card, SectionHeader, Skeleton, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function DashboardPage() {
  const { t } = useI18n();
  const [adviceIndex, setAdviceIndex] = useState(0);

  const summary = useQuery<Envelope>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch("/dashboard/summary"),
  });
  const trends = useQuery<Envelope>({
    queryKey: ["dashboard-trends"],
    queryFn: () => apiFetch("/dashboard/trends?range=30d"),
  });
  const calendar = useQuery<Envelope>({
    queryKey: ["dashboard-calendar"],
    queryFn: () => apiFetch("/dashboard/calendar"),
  });
  const advice = useQuery<Envelope>({
    queryKey: ["dashboard-advice"],
    queryFn: () => apiFetch("/dashboard/ai-advice"),
  });
  const onboarding = useQuery<Envelope>({
    queryKey: ["onboarding-status"],
    queryFn: () => apiFetch("/onboarding/status"),
  });

  const s = summary.data?.data;
  const points = trends.data?.data.points || [];
  const trendOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: points.map((p: any) => p.date) },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "var(--border)" } } },
    series: [
      {
        name: t("dashboard.weeklyMinutes"),
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        lineStyle: { color: "#2563EB", width: 2 },
        data: points.map((p: any) => p.minutes),
      },
    ],
  };

  const calendarDays = calendar.data?.data.days || [];

  return (
    <div>
      {onboarding.data?.data && !onboarding.data.data.completed && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">完成引导，让 AI 为你生成路线与计划</p>
            <p className="text-[13px] text-muted">只需要 2 分钟。</p>
          </div>
          <a href="/onboarding">
            <Button>开始引导</Button>
          </a>
        </Card>
      )}
      <SectionHeader
        title={t("dashboard.title")}
        subtitle={new Date().toLocaleDateString("zh-CN")}
        action={<Badge variant="success">Free plan</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.weeklyMinutes")}
          value={s?.weeklyMinutes ?? 0}
          unit="min"
          icon={<Clock className="h-4 w-4 text-primary" />}
          trend="+12%"
        />
        <StatCard
          label={t("dashboard.streak")}
          value={s?.streakDays ?? 0}
          unit="days"
          icon={<Award className="h-4 w-4 text-success" />}
        />
        <StatCard
          label={t("dashboard.skills")}
          value={s?.skillsCompleted ?? 0}
          icon={<Target className="h-4 w-4 text-warning" />}
        />
        <StatCard
          label={t("dashboard.projects")}
          value={s?.projectCount ?? 0}
          icon={<Briefcase className="h-4 w-4 text-ai" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("dashboard.trend")}</h2>
            <div className="flex gap-1">
              {["7d", "30d", "90d"].map((r) => (
                <button key={r} className="rounded-[6px] px-2 py-1 text-xs text-muted hover:bg-surface-muted">
                  {r}
                </button>
              ))}
            </div>
          </div>
          {trends.isLoading ? <Skeleton className="h-[280px]" /> : <EChart option={trendOption} height={280} />}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("dashboard.calendar")}</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.slice(0, 35).map((day: any, i: number) => (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-[4px] text-[11px]"
                style={{
                  backgroundColor: day.minutes > 30 ? "var(--primary)" : "var(--surface-muted)",
                  color: day.minutes > 30 ? "#fff" : "var(--muted)",
                  opacity: day.minutes ? 0.75 + Math.min(day.minutes / 120, 0.25) : 0.5,
                }}
              >
                {Number(day.date.slice(8))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-ai" />
              {t("dashboard.advice")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAdviceIndex((i) => i + 1)}
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {advice.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <>
              <p className="text-[13px] leading-relaxed">{advice.data?.data.advice}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(advice.data?.data.actions || []).map((a: string) => (
                  <Badge key={a} variant="ai">
                    {a}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            {t("dashboard.tasks")}
          </h2>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((task) => (
              <div key={task} className="flex items-center gap-3 rounded-[6px] border border-border px-3 py-2.5">
                <span className="h-4 w-4 rounded-[4px] border border-border" />
                <span className="flex-1 truncate text-[13px]">Task {task}</span>
                <span className="text-xs text-muted">60 min</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
