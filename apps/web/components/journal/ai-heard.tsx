"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import type { Journal } from "@/lib/journal";
import { easeStandard, easeEnter } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

interface AIHeardProps {
  journals: Journal[];
  date: string;
}

export function AIHeard({ journals, date }: AIHeardProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "hear", date],
    queryFn: () => journalCompanionApi.hear(journals),
    enabled: journals.length > 0,
    staleTime: 300_000,
  });

  if (dismissed) return null;

  const result = data?.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={easeEnter}
      className="mt-8"
    >
      <div className="h-px bg-border-subtle mb-6" />

      <div className="flex flex-col items-center text-center">
        {/* AI 星光符号 */}
        <div className="mb-3 flex items-center gap-2">
          <span className="ai-star text-[14px]">✦</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.aiHeard")}
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-16 items-center">
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[14px] text-text-tertiary"
            >
              ...
            </motion.div>
          </div>
        ) : result?.reflection ? (
          <>
            {/* AI 的温柔回应 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, ...easeStandard }}
              className="max-w-md text-[15px] leading-relaxed text-text-secondary"
            >
              "{result.reflection}"
            </motion.p>

            {/* 和我聊聊按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, ...easeStandard }}
              className="mt-5"
            >
              <Link
                href={`/journal/companion?date=${date}&mode=${result.suggestedMode ?? "chat"}`}
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-border-subtle bg-surface px-5 py-2.5 text-[13px] font-medium text-text transition-all hover:border-primary/30 hover:bg-surface-elevated hover:text-primary"
              >
                {t("journal.chatWithMe")}
                <span className="text-primary">→</span>
              </Link>
            </motion.div>
          </>
        ) : (
          <p className="max-w-md text-[14px] text-text-tertiary">
            {t("journal.aiHeardHint")}
          </p>
        )}

        {/* 关闭按钮 */}
        <button
          onClick={() => setDismissed(true)}
          className="mt-4 text-[11px] text-text-tertiary/60 hover:text-text-tertiary"
        >
          收起
        </button>
      </div>
    </motion.div>
  );
}
