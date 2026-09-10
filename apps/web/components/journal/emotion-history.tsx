"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { easeEnter, easeStandard } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"];
const MOOD_Y = [40, 30, 20, 10, 2];
const W = 600;
const H = 80;
const PAD = 20;

export function EmotionHistory() {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "weather", 30],
    queryFn: () => journalCompanionApi.getWeather(30),
    staleTime: 300_000,
  });

  const weather = data?.data;

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="h-px bg-border-subtle mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <span className="ai-star text-[12px]">✦</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.emotionHistory")}
          </span>
        </div>
        <div className="h-20 animate-pulse rounded-[14px] bg-surface-elevated/50" />
      </div>
    );
  }

  if (!weather || weather.forecast.length === 0) return null;

  const points = weather.forecast.map((f, i) => {
    const x = PAD + (i / Math.max(weather.forecast.length - 1, 1)) * (W - PAD * 2);
    const y = f.mood >= 0 ? MOOD_Y[f.mood] : H / 2;
    return { x, y, mood: f.mood, date: f.date };
  });

  const validPoints = points.filter((p) => p.mood >= 0);
  const pathD = validPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const dateLabels = [
    weather.forecast[0],
    weather.forecast[Math.floor(weather.forecast.length / 2)],
    weather.forecast[weather.forecast.length - 1],
  ].filter((f) => f);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeEnter}
      className="mt-8"
    >
      <div className="h-px bg-border-subtle mb-6" />

      <div className="mb-4 flex items-center gap-2">
        <span className="ai-star text-[12px]">✦</span>
        <span className="font-display text-[13px] font-medium text-text-secondary">
          {t("journal.emotionHistory")}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, ...easeStandard }}
      >
        <svg
          viewBox={`0 0 ${W} ${H + 15}`}
          className="w-full"
          style={{ maxWidth: "100%" }}
        >
          <line
            x1={PAD}
            y1={H - 5}
            x2={W - PAD}
            y2={H - 5}
            stroke="var(--color-border-subtle)"
            strokeWidth="1"
          />

          {pathD && (
            <motion.path
              d={pathD}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}

          {validPoints.map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="var(--color-primary)"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.02, ...easeStandard }}
            >
              <title>{`${p.date}: ${p.mood >= 0 ? MOOD_EMOJIS[p.mood] : "—"}`}</title>
            </motion.circle>
          ))}

          {dateLabels.map((f, i) => {
            const idx = weather.forecast.indexOf(f);
            const x = PAD + (idx / Math.max(weather.forecast.length - 1, 1)) * (W - PAD * 2);
            const label = f.date.slice(5);
            return (
              <text
                key={i}
                x={x}
                y={H + 10}
                fill="var(--color-text-tertiary)"
                fontSize="9"
                textAnchor={i === 0 ? "start" : i === dateLabels.length - 1 ? "end" : "middle"}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </motion.div>
    </motion.div>
  );
}
