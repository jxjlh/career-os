"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { useI18n } from "@/lib/i18n";
import { getCheckinStreak, getLifeDashboard } from "@/lib/life";
import { getMapStatistics } from "@/lib/life-map";

/**
 * LIFE STATS —— 4 个大数字杂志排版 + coda "You're becoming someone."
 * 数据聚合：
 *  - daysActive: totalCheckins（兜底，TODO 后端补精确字段）
 *  - goalsCreated: lifeDashboard.totalGoals
 *  - thingsFinished: lifeDashboard.completedGoals
 *  - placesVisited: mapStatistics.totalCities
 */
export function LifeStats() {
  const { t } = useI18n();
  const dashboard = useQuery({ queryKey: ["life-dashboard"], queryFn: getLifeDashboard });
  const streak = useQuery({ queryKey: ["life-checkin"], queryFn: getCheckinStreak });
  const mapStats = useQuery({ queryKey: ["map-statistics"], queryFn: getMapStatistics });

  const stats = [
    { value: streak.data?.totalCheckins ?? 0, label: t("dashboard.daysActive") },
    { value: dashboard.data?.totalGoals ?? 0, label: t("dashboard.goalsCreated") },
    { value: dashboard.data?.completedGoals ?? 0, label: t("dashboard.thingsFinished") },
    { value: mapStats.data?.totalCities ?? 0, label: t("dashboard.placesVisited") },
  ];

  return (
    <section className="mt-10">
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {t("dashboard.lifeStats")}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: i * 0.06 }}
          >
            <p className="font-display text-[36px] font-bold leading-none tracking-tight text-text sm:text-[42px]">
              {String(s.value).padStart(2, "0")}
            </p>
            <p className="mt-1.5 font-display text-[10px] font-medium uppercase tracking-[0.16em] text-text-tertiary">
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 font-display text-[14px] italic text-text-secondary">{t("dashboard.lifeStatsCoda")}</p>
    </section>
  );
}
