"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { easeEnter, easeStandard } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";

interface EmotionMirrorProps {
  date: string;
}

export function EmotionMirror({ date }: EmotionMirrorProps) {
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: ["journal-companion", "mirror", date],
    queryFn: () => journalCompanionApi.getMirror(date),
    staleTime: 300_000,
  });

  const mirror = data?.data;

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="h-px bg-border-subtle mb-6" />
        <div className="flex items-center gap-2 mb-4">
          <span className="ai-star text-[12px]">✦</span>
          <span className="font-display text-[13px] font-medium text-text-secondary">
            {t("journal.emotionMirror")}
          </span>
        </div>
        <div className="h-20 animate-pulse rounded-[14px] bg-surface-elevated/50" />
      </div>
    );
  }

  if (!mirror) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={easeEnter}
      className="mt-8"
    >
      <div className="h-px bg-border-subtle mb-6" />

      {/* 标题 */}
      <div className="mb-4 flex items-center gap-2">
        <span className="ai-star text-[12px]">✦</span>
        <span className="font-display text-[13px] font-medium text-text-secondary">
          {t("journal.emotionMirror")}
        </span>
        <span className="text-[11px] text-text-tertiary">
          {date}
        </span>
      </div>

      <div className="space-y-5">
        {/* 今天的你 */}
        {mirror.summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, ...easeStandard }}
          >
            <p className="text-[11px] text-text-tertiary mb-1">
              {t("journal.todayYou")}
            </p>
            <p className="text-[16px] text-text leading-relaxed">
              {mirror.summary}
            </p>
          </motion.div>
        )}

        {/* 今天出现得比较多的 */}
        {mirror.moodTags && mirror.moodTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, ...easeStandard }}
          >
            <p className="text-[11px] text-text-tertiary mb-2">
              {t("journal.moodThemes")}
            </p>
            <div className="flex flex-wrap gap-2">
              {mirror.moodTags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1.5 text-[12px] text-text-secondary"
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* AI 注意到 */}
        {mirror.observation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, ...easeStandard }}
            className="border-l-2 border-ai/20 pl-4"
          >
            <p className="text-[11px] text-text-tertiary mb-1">
              {t("journal.aiNoticed")}
            </p>
            <p className="text-[14px] leading-relaxed text-text-secondary">
              {mirror.observation}
            </p>
            {mirror.insight && (
              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                {mirror.insight}
              </p>
            )}
          </motion.div>
        )}

        {/* 和我聊聊 */}
        <div>
          <Link
            href={`/journal/companion?date=${date}&mode=reflect`}
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
