"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";

const MOODS = ["😵", "😐", "🙂", "😎", "✨"] as const;

function todayKey() {
  const d = new Date();
  return `career_os_mood_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * TODAY'S MOOD —— 5 emoji 一键选择，localStorage 持久化当日心情。
 * 不做成问卷，记录后显示"今天还不错"。极轻量，无 API 依赖。
 * TODO: 后端 /life/mood POST 接口就绪后切换到 react-query mutation。
 */
export function MoodPicker() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey());
      if (saved !== null) {
        setSelected(Number(saved));
        setRecorded(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const pick = (i: number) => {
    setSelected(i);
    setRecorded(true);
    try {
      localStorage.setItem(todayKey(), String(i));
    } catch {
      // ignore
    }
  };

  return (
    <section className="mt-10">
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {t("dashboard.todaysMood")}
      </h2>
      <p className="mt-1 text-[13px] text-text-tertiary">{t("dashboard.moodPrompt")}</p>
      <div className="mt-3 flex items-center gap-2">
        {MOODS.map((m, i) => (
          <motion.button
            key={m}
            onClick={() => pick(i)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`flex h-11 w-11 items-center justify-center rounded-[12px] text-xl transition-colors ${
              selected === i
                ? "bg-primary/12 ring-1 ring-primary/40"
                : "bg-surface/40 hover:bg-surface-elevated/60"
            }`}
            aria-label={`mood ${i}`}
          >
            {m}
          </motion.button>
        ))}
        {recorded && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="ml-2 text-[13px] text-text-secondary"
          >
            {t("dashboard.moodRecorded")}
          </motion.span>
        )}
      </div>
    </section>
  );
}
