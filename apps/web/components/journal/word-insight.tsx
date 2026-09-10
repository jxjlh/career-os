"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { easeEnter, easeStandard } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

interface WordInsightProps {
  word: string;
  onClose: () => void;
}

export function WordInsight({ word, onClose }: WordInsightProps) {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "word", word],
    queryFn: () => journalCompanionApi.getWordInsight(word),
    enabled: !!word,
    staleTime: 300_000,
  });

  const insight = data?.data;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={easeStandard}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-[20px] border border-border bg-surface p-6 shadow-soft"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="ai-star text-[14px]">✦</span>
              <span className="font-display text-[14px] font-semibold text-text">
                {t("journal.wordInsight")}
              </span>
            </div>
            <button onClick={onClose} className="text-text-tertiary hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <span className="text-[20px] font-display font-bold text-text">
              {word}
            </span>
            {insight && (
              <span className="ml-2 text-[12px] text-text-tertiary">
                {insight.count} {t("journal.wordMentionCount")}
              </span>
            )}
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
          ) : insight ? (
            <div className="space-y-4">
              {insight.coOccurrences && insight.coOccurrences.length > 0 && (
                <div>
                  <p className="text-[11px] text-text-tertiary mb-2">
                    {t("journal.coOccurring")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {insight.coOccurrences.map((w, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-[12px] text-text-secondary"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {insight.aiObservation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, ...easeStandard }}
                  className="border-l-2 border-ai/20 pl-4"
                >
                  <p className="text-[11px] text-text-tertiary mb-1">
                    {t("journal.aiObservation")}
                  </p>
                  <p className="text-[14px] leading-relaxed text-text-secondary">
                    {insight.aiObservation}
                  </p>
                </motion.div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-text-tertiary">
              没有找到关于这个词的记录。
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
