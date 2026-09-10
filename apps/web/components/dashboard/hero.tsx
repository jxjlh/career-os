"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PencilLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const MOTTO_KEY = "career_os_motto";

export function Hero() {
  const { t } = useI18n();
  const [emailName, setEmailName] = useState("");
  const [motto, setMotto] = useState("");
  const [editingMotto, setEditingMotto] = useState(false);

  const me = useQuery<{ data: { displayName: string | null; email: string } }>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/me"),
  });

  useEffect(() => {
    if (supabase) {
      supabase.auth
        .getUser()
        .then(({ data }) => {
          const email = data.user?.email ?? "";
          setEmailName(email ? email.split("@")[0] : "");
        })
        .catch(() => {});
    }
    try {
      setMotto(localStorage.getItem(MOTTO_KEY) ?? "");
    } catch {}
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.goodMorning") : hour < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  const name = me.data?.data?.displayName || emailName;
  const displayName = name ? name.toUpperCase() : "";
  const displayMotto = motto || t("dashboard.heroMottoFallback");

  const today = new Date();
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[today.getDay()];

  const saveMotto = () => {
    try {
      localStorage.setItem(MOTTO_KEY, motto);
    } catch {}
    setEditingMotto(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-primary/8 via-surface to-surface px-6 py-8 sm:px-8 sm:py-10 border border-border-subtle">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-[100px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-accent-2/8 blur-[80px]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary"
          >
            {greeting}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className="mt-1 font-display text-[28px] font-bold tracking-tight text-text sm:text-[32px]"
          >
            {displayName || "YOU"}
            <span className="text-primary">.</span>
          </motion.h1>

          <div className="relative mt-4 max-w-xl">
            {editingMotto ? (
              <textarea
                autoFocus
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                onBlur={saveMotto}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveMotto();
                  }
                }}
                rows={2}
                className="block w-full resize-none rounded-[12px] border border-border bg-surface px-3 py-2 text-[15px] text-text outline-none focus:border-primary/40"
              />
            ) : (
              <p className="text-[15px] leading-relaxed text-text-secondary">
                {displayMotto}
              </p>
            )}
            <button
              onClick={() => setEditingMotto((v) => !v)}
              aria-label={t("dashboard.heroEdit")}
              className="mt-2 flex items-center gap-1 text-[12px] text-text-tertiary transition-colors hover:text-primary"
            >
              <PencilLine className="h-3.5 w-3.5" />
              {t("dashboard.heroEdit")}
            </button>
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <div className="flex items-center gap-2 rounded-[12px] border border-border-subtle bg-surface px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="leading-none">
              <p className="text-[20px] font-bold text-text">{date}</p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">{month}月 · 周{weekday}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
