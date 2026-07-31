"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { useState } from "react";

import type { YearReviewResponse } from "@/lib/life";

type ShareKind = "social" | "xiaohongshu" | "copy";

function statNumbers(review: YearReviewResponse) {
  const s = review.statistics || {};
  return {
    goals: s.goalsCompleted ?? s.goals_completed ?? 0,
    tasks: s.tasksCompleted ?? s.tasks_completed ?? 0,
    records: s.recordsCreated ?? s.records_created ?? 0,
    xp: s.xpGained ?? s.xp_gained ?? 0,
  };
}

/** 朋友圈文案: 简短、数字突出、带年份祝福. */
function buildSocialText(review: YearReviewResponse): string {
  const { goals, records, xp } = statNumbers(review);
  const next = review.year + 1;
  return [
    `${review.year}`,
    `完成${goals}个目标`,
    `获得${xp}XP`,
    `记录${records}次人生瞬间。`,
    `新的${next}，继续加油。`,
  ].join("\n");
}

/** 小红书文案: 故事感, 直接拼接 summary / reflection / nextYearPlan. */
function buildXiaohongshuText(review: YearReviewResponse): string {
  const lines: string[] = ["今年我终于完成了这些目标……", ""];
  if (review.summary) lines.push(review.summary, "");
  if (review.reflection) lines.push(review.reflection, "");
  if (review.nextYearPlan && review.nextYearPlan.length > 0) {
    lines.push("明年计划：");
    for (const item of review.nextYearPlan) lines.push(`- ${item}`);
  }
  return lines.join("\n");
}

function buildText(review: YearReviewResponse, kind: ShareKind): string {
  return kind === "social" ? buildSocialText(review) : buildXiaohongshuText(review);
}

const SHARE_OPTIONS: Array<{ kind: ShareKind; icon: string; label: string; hint: string }> = [
  { kind: "social", icon: "📱", label: "朋友圈", hint: "复制朋友圈文案" },
  { kind: "xiaohongshu", icon: "📖", label: "小红书", hint: "复制小红书文案" },
  { kind: "copy", icon: "📋", label: "复制文本", hint: "复制完整报告摘要" },
];

/**
 * 分享弹窗: 基于现有 year-review 数据生成社交文案并复制到剪贴板.
 * 下载图片按钮暂预留 (disabled), 待后续接入截图能力.
 */
export function ShareReviewDialog({
  review,
  open,
  onOpenChange,
}: {
  review: YearReviewResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleShare = async (kind: ShareKind) => {
    const text =
      kind === "copy"
        ? [review.summary, review.reflection, review.nextYearPlan.join("\n")]
            .filter(Boolean)
            .join("\n\n")
        : buildText(review, kind);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const previewText = buildSocialText(review);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Share2 className="h-4 w-4 text-primary" />
                分享我的年度报告
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => onOpenChange(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 p-4">
              {SHARE_OPTIONS.map((option) => {
                const isCopied = copied === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => handleShare(option.kind)}
                    className="flex w-full items-center gap-3 rounded-[10px] border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-surface-muted text-xl">
                      {option.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs text-muted">{option.hint}</p>
                    </div>
                    {isCopied ? (
                      <Check className="h-4 w-4 flex-none text-success" />
                    ) : (
                      <Copy className="h-4 w-4 flex-none text-muted" />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-[10px] border border-dashed border-border bg-surface-muted/50 p-3 text-left opacity-60"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-surface-muted text-xl">
                  🖼️
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">下载图片</p>
                  <p className="text-xs text-muted">即将上线</p>
                </div>
                <Download className="h-4 w-4 flex-none text-muted" />
              </button>
            </div>

            <div className="border-t border-border bg-surface-muted/40 p-4">
              <p className="mb-2 text-xs font-medium text-muted">文案预览</p>
              <pre className="whitespace-pre-wrap break-words rounded-[8px] bg-surface p-3 text-xs leading-relaxed text-text/80">
                {previewText}
              </pre>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
