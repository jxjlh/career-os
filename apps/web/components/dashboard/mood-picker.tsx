"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const MOODS = ["😵", "😐", "🙂", "😎", "✨"] as const;

type Envelope = { data: any };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * TODAY'S MOOD —— 5 emoji 一键选择。
 * 存在服务端（/planner/daily 的 mood 字段），手机端与电脑端同一账号看到同一份心情。
 */
export function MoodPicker() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");

  // 挂载后再算「今天」，避免服务端/客户端时间不同导致 hydration 不一致
  useEffect(() => {
    setDate(todayIso());
  }, []);

  const daily = useQuery<Envelope>({
    queryKey: ["planner-daily", date],
    queryFn: () => apiFetch(`/planner/daily?date=${date}`),
    enabled: Boolean(date),
  });
  const saved: number | null = daily.data?.data?.mood ?? null;

  const saveMood = useMutation({
    mutationFn: (mood: number) =>
      apiFetch(`/planner/daily?date=${date}`, {
        method: "PUT",
        body: JSON.stringify({ mood }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["planner-daily"] });
    },
  });

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
            onClick={() => saveMood.mutate(i + 1)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`flex h-11 w-11 items-center justify-center rounded-[12px] text-xl transition-colors ${
              saved === i + 1
                ? "bg-primary/12 ring-1 ring-primary/40"
                : "bg-surface/40 hover:bg-surface-elevated/60"
            }`}
            aria-label={`mood ${i}`}
          >
            {m}
          </motion.button>
        ))}
        {saved !== null && (
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
