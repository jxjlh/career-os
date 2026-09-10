"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { easeEnter, easeStandard } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

export function LongTermPatterns() {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "patterns"],
    queryFn: () => journalCompanionApi.getPatterns(),
    staleTime: 600_000,
  });

  const patterns = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="h-px bg-border-subtle mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <span className="ai-star text-[12px]">✦</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.longTermPatterns")}
          </span>
        </div>
        <div className="h-20 animate-pulse rounded-[14px] bg-surface-elevated/50" />
      </div>
    );
  }

  if (patterns.length === 0) return null;

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
          {t("journal.longTermPatterns")}
        </span>
      </div>

      <div className="space-y-5">
        {patterns.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 * (i + 1), ...easeStandard }}
            className="border-l-2 border-ai/20 pl-4"
          >
            <p className="text-[14px] leading-relaxed text-text">
              {p.pattern}
            </p>

            {p.relatedWords && p.relatedWords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.relatedWords.map((word, wi) => (
                  <span
                    key={wi}
                    className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] text-text-tertiary"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}

            {p.conclusion && (
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                {p.conclusion}
              </p>
            )}
          </motion.div>
        ))}

        <div>
          <Link
            href="/journal/companion?mode=reflect"
            className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
          >
            {t("journal.chatWithMe")}
            <span>→</span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
