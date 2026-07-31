"use client";

import { useQuery } from "@tanstack/react-query";

import { EChart } from "@/components/chart";
import { Card, SectionHeader, Skeleton, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function AnalyticsPage() {
  const { t } = useI18n();
  const overview = useQuery<Envelope>({
    queryKey: ["analytics-overview"],
    queryFn: () => apiFetch("/analytics/overview"),
  });
  const data = overview.data?.data;

  const barOption = {
    tooltip: {},
    grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: ["Week 1", "Week 2", "Week 3", "Week 4"], axisLabel: { color: "var(--muted)" } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "var(--border)" } } },
    series: [
      {
        type: "bar",
        data: [120, 180, 160, 240],
        itemStyle: { color: "#2563EB", borderRadius: [4, 4, 0, 0] },
        barWidth: 24,
      },
    ],
  };

  return (
    <div>
      <SectionHeader title={t("nav.analytics")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("analytics.totalMinutes")} value={data?.totalMinutes ?? 0} />
        <StatCard label={t("analytics.avgDay")} value={data?.avgMinutesPerDay ?? 0} unit="min" />
        <StatCard label={t("analytics.completion")} value={`${data?.completionRate ?? 0}%`} />
        <StatCard label={t("analytics.projects")} value={data?.projectCount ?? 0} />
      </div>
      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">{t("analytics.studyByWeek")}</h2>
        {overview.isLoading ? <Skeleton className="h-[260px]" /> : <EChart option={barOption} height={260} />}
      </Card>
    </div>
  );
}
