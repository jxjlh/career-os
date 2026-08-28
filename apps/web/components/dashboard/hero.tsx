"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PencilLine } from "lucide-react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const MOTTO_KEY = "career_os_motto";

/**
 * Hero —— 动态问候 GOOD MORNING/AFTERNOON/EVENING + 名字 + 居中人生格言。
 * 不做 Card，用淡渐变 + ambient glow + noise。格言存 localStorage（无后端 profile API）。
 */
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
    } catch {
      // ignore
    }
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("dashboard.goodMorning") : hour < 18 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  const name = me.data?.data?.displayName || emailName;
  const displayName = name ? name.toUpperCase() : "";
  const displayMotto = motto || t("dashboard.heroMottoFallback");

  const saveMotto = () => {
    try {
      localStorage.setItem(MOTTO_KEY, motto);
    } catch {
      // ignore
    }
    setEditingMotto(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[20px] px-1 py-8 sm:px-4 sm:py-12">
      {/* ambient glow —— 三个 radial 光晕，极淡 */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-info/8 blur-[80px]" />
      <div className="noise" />

      <div className="relative">
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary"
          >
            {greeting}
          </motion.p>

          <p className="mt-1 text-primary-glow">{displayName || "YOU"}.</p>
        </div>

        <div className="relative mt-6 px-8 text-center">
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
              className="mx-auto block w-full max-w-2xl resize-none rounded-[10px] border border-border-subtle bg-surface/60 px-3 py-2 text-center font-manrope text-[15px] text-text outline-none focus:border-primary/40"
            />
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              className="mx-auto max-w-2xl font-manrope text-center text-[18px] leading-relaxed text-text sm:text-[20px]"
            >
              {displayMotto}
            </motion.h1>
          )}
          <button
            onClick={() => setEditingMotto((v) => !v)}
            aria-label={t("dashboard.heroEdit")}
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
          >
            <PencilLine className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
