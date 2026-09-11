"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";

import { easeStandard } from "@/lib/motion";
import { motion } from "framer-motion";

const COLS = 6;
const ROWS = 8;
const TOTAL = COLS * ROWS;

/** 合成"啵"的破泡音效（Web Audio，无外部资源） */
function playPop() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const f = 500 + Math.random() * 500;
    osc.frequency.setValueAtTime(f, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, f * 0.25), ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // 音效失败不影响玩法
  }
}

export default function VentPage() {
  const router = useRouter();
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const [round, setRound] = useState(1);
  const lastPopRef = useRef(0);

  const pop = (i: number) => {
    if (popped.has(i)) return;
    playPop();
    // 移动端轻微震动反馈（iOS Safari 不支持则静默跳过）
    try {
      navigator.vibrate?.(12);
    } catch {}
    // 连续快速捏时给一个轻微的节奏感：极短间隔内相同反馈即可
    lastPopRef.current = Date.now();
    setPopped((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  const reset = () => {
    setPopped(new Set());
    setRound((r) => r + 1);
  };

  const done = popped.size >= TOTAL;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-background">
      {/* 顶部导航 */}
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px]">🫧</span>
            <span className="font-display text-[15px] font-semibold text-text">
              捏泡泡 · 捏碎烦恼
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary">
            想捏就捏，把烦心事都捏破
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary">
          {popped.size}/{TOTAL}
        </span>
      </header>

      {/* 泡泡纸 */}
      <div className="relative flex-1 px-3 py-4">
        <div
          className="mx-auto grid max-w-md select-none gap-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: TOTAL }, (_, i) => {
            const isPopped = popped.has(i);
            return (
              <motion.button
                key={`${round}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...easeStandard, delay: Math.min(i * 0.004, 0.3) }}
                onClick={() => pop(i)}
                disabled={isPopped}
                aria-label={isPopped ? "已捏破" : `捏破第 ${i + 1} 个泡泡`}
                className={`aspect-square rounded-full transition-all duration-150 active:scale-90 ${
                  isPopped
                    ? "scale-[0.88] cursor-default bg-surface-muted shadow-[inset_0_2px_6px_rgba(0,0,0,0.18)]"
                    : "cursor-pointer bg-[radial-gradient(circle_at_32%_28%,#ffffff_0%,#dbe7ff_38%,#b9d0fb_72%,#9dbdf5_100%)] shadow-[0_3px_8px_rgba(91,157,255,0.25),inset_0_-2px_4px_rgba(91,157,255,0.25)] hover:brightness-105 dark:bg-[radial-gradient(circle_at_32%_28%,#3d4d6b_0%,#2c3a55_38%,#243148_72%,#1d2940_100%)] dark:shadow-[0_3px_8px_rgba(0,0,0,0.35),inset_0_-2px_4px_rgba(0,0,0,0.3)]"
                }`}
              />
            );
          })}
        </div>

        {/* 全部捏完的庆祝层 */}
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={easeStandard}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <span className="text-[40px]">🎉</span>
            <p className="mt-3 font-display text-[20px] font-bold text-text">
              爽！全捏完了
            </p>
            <p className="mt-1.5 text-[13px] text-text-secondary">
              烦恼碎了一地。还想捏吗？
            </p>
            <button
              onClick={reset}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-primary-hover"
            >
              <RotateCcw className="h-4 w-4" />
              再来一张
            </button>
          </motion.div>
        )}
      </div>

      <p
        className="px-4 pb-4 text-center text-[11px] text-text-tertiary"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        提示：捏的时候会发出「啵」的声音， 戴耳机效果更佳
      </p>
    </div>
  );
}
