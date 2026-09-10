"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { getCheckinStreak } from "@/lib/life";

export function StreakCard() {
  const { t } = useI18n();
  const streak = useQuery({ queryKey: ["life-checkin"], queryFn: getCheckinStreak });
  const [displayed, setDisplayed] = useState(0);

  const current = streak.data?.currentStreak ?? 0;

  useEffect(() => {
    if (current === displayed) return;
    const diff = current - displayed;
    const step = Math.max(1, Math.ceil(Math.abs(diff) / 8)) * Math.sign(diff);
    const id = setInterval(() => {
      setDisplayed((prev) => {
        const next = prev + step;
        if ((step > 0 && next >= current) || (step < 0 && next <= current)) {
          clearInterval(id);
          return current;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(id);
  }, [current, displayed]);

  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  const dots = weekDays.map((_, i) => {
    if (current === 0) return false;
    const dayOffset = i - todayIdx;
    return dayOffset <= 0 && dayOffset > -Math.min(current, 7);
  });

  return (
    <section className="mt-8">
      <div className="flex items-end gap-4">
        <span className="text-2xl">🔥</span>
        <motion.div
          key={current}
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-baseline gap-2"
        >
          <span className="font-display text-[48px] font-bold leading-none tracking-tight text-text">
            {String(displayed).padStart(2, "0")}
          </span>
          <span className="font-display text-[14px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            DAYS
          </span>
        </motion.div>
        <span className="font-display pb-1 text-[12px] font-medium uppercase tracking-[0.16em] text-primary">
          {t("dashboard.keepGoing")}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {weekDays.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="font-display text-[10px] font-medium uppercase text-text-tertiary">{d}</span>
            <span
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                dots[i] ? "bg-primary" : "bg-surface-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {current > 0 && (
        <p className="mt-4 text-[13px] text-text-secondary">
          {t("dashboard.streakSuffix").replace("{days}", String(current))}
        </p>
      )}
    </section>
  );
}
