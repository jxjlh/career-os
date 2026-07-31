"use client";

import { motion } from "framer-motion";
import { BookOpen, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui";
import type { JournalResponse } from "@/lib/life";

interface JournalResultCardProps {
  result: JournalResponse | null;
  loading?: boolean;
}

/** AI 日志生成结果卡片: 标题 / 正文 / 感悟 / 关键词. */
export function JournalResultCard({ result, loading }: JournalResultCardProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-[12px] border border-border bg-surface p-4">
        <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }
  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-[12px] border border-ai/30 bg-gradient-to-br from-ai/5 to-transparent p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-ai" />
          <span className="text-sm font-semibold">AI 日志</span>
        </div>
        <Badge variant={result.source === "ai" ? "ai" : "default"}>
          {result.source === "ai" ? "AI" : "智能生成"}
        </Badge>
      </div>

      {result.title && (
        <h3 className="text-base font-semibold leading-snug">{result.title}</h3>
      )}

      {result.body && (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{result.body}</p>
      )}

      {result.reflection && (
        <div className="flex items-start gap-2 border-l-2 border-ai/40 pl-2.5">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-ai" />
          <p className="text-xs italic leading-relaxed text-muted">{result.reflection}</p>
        </div>
      )}

      {result.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.keywords.map((kw, i) => (
            <span
              key={`${kw}-${i}`}
              className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
            >
              #{kw}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
