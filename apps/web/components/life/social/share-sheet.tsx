"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2, MessageCircle, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/life/social/ui-extras";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  /** 用于生成分享链接的资源路径, 如 /life/goals/abc */
  path: string;
  title: string;
  description?: string;
  /** 是否展示朋友圈 / 小红书文案生成, 默认 true */
  showCopywriting?: boolean;
}

type CopyState = "idle" | "copied";

/**
 * 分享面板: 复制链接 / 二维码占位 / 朋友圈文案 / 小红书文案.
 * 纯前端实现, 无需 AI: 文案基于标题 + 描述拼接为通用模板.
 */
export function ShareSheet({
  open,
  onClose,
  path,
  title,
  description,
  showCopywriting = true,
}: ShareSheetProps) {
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (!open) setCopyState("idle");
  }, [open]);

  const copy = async (text: string, label: "link" | "copywriting") => {
    try {
      await navigator.clipboard.writeText(text);
      if (label === "link") {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1500);
      }
    } catch {
      // 剪贴板不可用时静默失败, 用户可手动复制
    }
  };

  const momentsText = buildMomentsCopy(title, description);
  const xhsText = buildXhsCopy(title, description);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[16px] border border-border bg-surface p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">分享</h3>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* 复制链接 */}
              <button
                type="button"
                onClick={() => copy(shareUrl, "link")}
                className="flex w-full items-center justify-between rounded-[10px] border border-border bg-surface-muted/50 p-3 text-left transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2.5">
                  {copyState === "copied" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Link2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">
                    {copyState === "copied" ? "已复制链接" : "复制链接"}
                  </span>
                </span>
                <span className="max-w-[140px] truncate text-xs text-muted">{shareUrl}</span>
              </button>

              {/* 二维码占位 */}
              <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-border p-4">
                <div className="grid h-28 w-28 grid-cols-8 grid-rows-8 gap-0.5 rounded-[6px] bg-surface-muted/40 p-2">
                  {Array.from({ length: 64 }).map((_, i) => {
                    // 伪随机二维码图案, 仅视觉占位
                    const seed = (i * 7 + title.length * 3) % 5;
                    return (
                      <span
                        key={i}
                        className={seed < 2 ? "rounded-[1px] bg-text" : "rounded-[1px] bg-transparent"}
                      />
                    );
                  })}
                </div>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Share2 className="h-3 w-3" />
                  扫码分享
                </p>
              </div>

              {showCopywriting && (
                <>
                  <CopywritingBlock
                    label="朋友圈文案"
                    icon={<MessageCircle className="h-3.5 w-3.5" />}
                    text={momentsText}
                    onCopy={() => copy(momentsText, "copywriting")}
                  />
                  <CopywritingBlock
                    label="小红书文案"
                    icon={<span className="text-xs">📕</span>}
                    text={xhsText}
                    onCopy={() => copy(xhsText, "copywriting")}
                  />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CopywritingBlock({
  label,
  icon,
  text,
  onCopy,
}: {
  label: string;
  icon: React.ReactNode;
  text: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-[10px] border border-border bg-surface-muted/50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {icon}
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-primary hover:opacity-80"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}

function buildMomentsCopy(title: string, description?: string): string {
  const lines = [`✨ ${title}`];
  if (description) lines.push(description);
  lines.push("", "在 AI LifeOS 记录我的人生轨迹, 一起成长。");
  return lines.join("\n");
}

function buildXhsCopy(title: string, description?: string): string {
  const tags = ["#人生必做", "#自我成长", "#AI生活", "#LifeOS"];
  const lines = [`📌 ${title}`, ""];
  if (description) lines.push(description, "");
  lines.push("用 AI LifeOS 把目标变成可执行的旅程, 期待和你一起打卡 ✨");
  lines.push("", tags.join(" "));
  return lines.join("\n");
}
