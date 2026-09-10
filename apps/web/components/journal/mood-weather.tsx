"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { easeEnter, easeStandard } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

const WEATHER_EMOJIS = ["☀️", "⛅", "☁️", "🌧️", "⛈️"];

export function MoodWeather() {
  const { t } = useI18n();
  const [days, setDays] = useState<7 | 30>(7);

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "weather", days],
    queryFn: () => journalCompanionApi.getWeather(days),
    staleTime: 300_000,
  });

  const weather = data?.data;

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="h-px bg-border-subtle mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[12px]">🌤️</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.moodWeather")}
          </span>
        </div>
        <div className="h-16 animate-pulse rounded-[14px] bg-surface-elevated/50" />
      </div>
    );
  }

  if (!weather || weather.forecast.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeEnter}
      className="mt-8"
    >
      <div className="h-px bg-border-subtle mb-6" />

      {/* 标题 + 切换 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px]">🌤️</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.moodWeather")}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setDays(7)}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] transition-colors ${
              days === 7
                ? "bg-surface-elevated text-text"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            7天
          </button>
          <button
            onClick={() => setDays(30)}
            className={`rounded-[8px] px-2.5 py-1 text-[11px] transition-colors ${
              days === 30
                ? "bg-surface-elevated text-text"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            30天
          </button>
        </div>
      </div>

      {/* 天气预报序列 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, ...easeStandard }}
        className="flex flex-wrap gap-1.5 mb-4"
      >
        {weather.forecast.map((f, i) => (
          <motion.div
            key={f.date}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02, ...easeStandard }}
            className="flex h-10 w-10 items-center justify-center text-lg"
            title={f.date}
          >
            {WEATHER_EMOJIS[f.mood] ?? "☁️"}
          </motion.div>
        ))}
      </motion.div>

      {/* 最近的你 */}
      {weather.summary && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, ...easeStandard }}
          className="text-[14px] leading-relaxed text-text-secondary"
        >
          <span className="text-text-tertiary">{t("journal.recentYou")}</span>
          {weather.summary}
        </motion.p>
      )}
    </motion.div>
  );
}
