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
  const weekly = useQuery<Envelope>({
    queryKey: ["analytics-weekly", 8],
    queryFn: () => apiFetch("/analytics/weekly?weeks=8"),
  });
  const data = overview.data?.data;
  const weeks: any[] = weekly.data?.data?.items || [];
  // 没有任何真实学习记录时，不画柱状图，直接说明原因（不编造数字）
  const hasAnyMinutes = weeks.some((w) => (w.minutes || 0) > 0);

  const barOption = {
    tooltip: { valueSuffix: " min" },
    grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: weeks.map((w) => w.label),
      axisLabel: { color: "var(--muted)" },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "var(--border)" } } },
    series: [
      {
        type: "bar",
        name: t("analytics.taskMinutes"),
        stack: "study",
        data: weeks.map((w) => w.taskMinutes || 0),
        itemStyle: { color: "#2563EB", borderRadius: [4, 4, 0, 0] },
        barWidth: 24,
      },
      {
        type: "bar",
        name: t("analytics.englishMinutes"),
        stack: "study",
        data: weeks.map((w) => w.englishMinutes || 0),
        itemStyle: { color: "#06B6D4", borderRadius: [4, 4, 0, 0] },
        barWidth: 24,
      },
    ],
    legend: { bottom: 0, textStyle: { color: "var(--muted)" } },
  };

  return (
    <div>
      <SectionHeader
        title={t("nav.analytics")}
        subtitle={t("analytics.realDataHint")}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("analytics.totalMinutes")} value={data?.totalMinutes ?? 0} unit="min" />
        <StatCard label={t("analytics.avgDay")} value={data?.avgMinutesPerDay ?? 0} unit="min" />
        <StatCard label={t("analytics.completion")} value={`${data?.completionRate ?? 0}%`} />
        <StatCard label={t("analytics.projects")} value={data?.projectCount ?? 0} />
        <StatCard label={t("analytics.avgMastery")} value={`${data?.avgMasteryPercent ?? 0}%`} />
        <StatCard label={t("analytics.activeDays")} value={data?.activeDays ?? 0} unit={t("analytics.days")} />
        <StatCard label={t("analytics.reviewDays")} value={data?.reviewDays ?? 0} unit={t("analytics.days")} />
        <StatCard label={t("analytics.doneTasks")} value={data?.resourcesCompleted ?? 0} />
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-1 text-sm font-semibold">{t("analytics.studyByWeek")}</h2>
        <p className="mb-3 text-xs text-muted">{t("analytics.studyByWeekDesc")}</p>
        {weekly.isLoading ? (
          <Skeleton className="h-[260px]" />
        ) : hasAnyMinutes ? (
          <EChart option={barOption} height={260} />
        ) : (
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted">{t("analytics.noStudyData")}</p>
            <p className="text-xs text-muted">{t("analytics.noStudyDataDesc")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
