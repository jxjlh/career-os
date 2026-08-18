"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";

import { journalApi, type Journal } from "@/lib/journal";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;

/**
 * Daily Journal —— 每日小记内容展示
 * 展示当天的小记内容，包括心情、内容、标签等
 */
export function LifeStats() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data, isLoading } = useQuery<{ data: Journal | null }>({
    queryKey: ["journal", todayStr],
    queryFn: () => journalApi.getByDate(todayStr),
    staleTime: 0,
  });

  const journal = data?.data;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]}`;
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          每日小记
        </h2>
        <Link
          href="/journal"
          className="text-[12px] text-text-tertiary transition-colors hover:text-text-secondary"
        >
          去记录 →
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3 rounded-[16px] border border-border-subtle/60 bg-surface/30 p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
        </div>
      ) : journal ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mt-4 rounded-[16px] border border-border-subtle/60 bg-surface/30 p-5"
        >
          {/* 头部：日期 + 心情 */}
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {formatDate(journal.journalDate)}
            </span>
            {journal.moodIndex !== undefined && journal.moodIndex !== null && (
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-lg">
                {MOOD_EMOJIS[journal.moodIndex] ?? "🙂"}
              </span>
            )}
          </div>

          {/* 小记内容 */}
          {journal.content ? (
            <p className="mt-3 text-[14px] leading-relaxed text-text">
              {journal.content}
            </p>
          ) : (
            <p className="mt-3 text-[13px] italic text-text-tertiary">
              今天的心情不错，但还没有写下什么...
            </p>
          )}

          {/* 标签 */}
          {journal.tags && journal.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {journal.tags.map((tag, i) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15, delay: i * 0.05 }}
                  className="rounded-[8px] bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mt-4 rounded-[16px] border border-dashed border-border-subtle bg-surface/20 p-6 text-center"
        >
          <div className="flex justify-center gap-2 text-2xl">
            {MOOD_EMOJIS.map((m, i) => (
              <motion.span
                key={m}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                className="cursor-pointer opacity-60 hover:opacity-100"
              >
                {m}
              </motion.span>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-text-tertiary">
            今天感觉如何？记录一下吧
          </p>
          <Link
            href="/journal"
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
          >
            开始记录
            <span aria-hidden="true">→</span>
          </Link>
        </motion.div>
      )}
    </section>
  );
}
