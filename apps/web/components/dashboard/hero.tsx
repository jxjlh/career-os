"use client";

import { motion } from "framer-motion";
import { PencilLine } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const MOTTO_KEY = "career_os_motto";

/**
 * Hero —— 动态问候 GOOD MORNING/AFTERNOON/EVENING + 名字 + 人生格言 + Edit。
 * 不做 Card，用淡渐变 + ambient glow + noise。格言存 localStorage（无后端 profile API）。
 */
export function Hero() {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const email = data.user?.email ?? "";
        setName(email ? email.split("@")[0] : "");
      })
      .catch(() => {});
    try {
      setMotto(localStorage.getItem(MOTTO_KEY) ?? "");
    } catch {
      // ignore
    }
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.goodMorning") : hour < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  const displayName = name ? name.toUpperCase() : "";
  const displayMotto = motto || t("dashboard.heroMottoFallback");

  const saveMotto = () => {
    try {
      localStorage.setItem(MOTTO_KEY, motto);
    } catch {
      // ignore
    }
    setEditing(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[20px] px-1 py-8 sm:px-4 sm:py-12">
      {/* ambient glow —— 三个 radial 光晕，极淡 */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-info/8 blur-[80px]" />
      <div className="noise" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary"
          >
            {greeting}
            {displayName && (
              <span className="ml-2 text-primary-glow">{displayName}.</span>
            )}
          </motion.p>

          {editing ? (
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
              className="mt-3 w-full max-w-xl resize-none rounded-[10px] border border-border-subtle bg-surface/60 px-3 py-2 font-manrope text-[15px] text-text outline-none focus:border-primary/40"
            />
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              className="mt-3 max-w-xl font-manrope text-[18px] leading-relaxed text-text sm:text-[20px]"
            >
              {displayMotto}
            </motion.h1>
          )}
        </div>

        <button
          onClick={() => setEditing((v) => !v)}
          aria-label={t("dashboard.heroEdit")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <PencilLine className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
