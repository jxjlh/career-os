"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

import { easeStandard } from "@/lib/motion";

const COLS = 6;
const ROWS = 8;
const TOTAL = COLS * ROWS;
const PARTICLE_COLORS = ["#7BB0FF", "#5B9DFF", "#C49A5C", "#FFFFFF", "#9CC8FF", "#F5F8FF"];

// ── 音效：共享 AudioContext（首次交互解锁），扫频正弦 + 高频噪声瞬态，"啵"得更真实 ──
let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function playPop() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const f = 550 + Math.random() * 600;

  // 主体：正弦扫频
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(100, f * 0.2), t + 0.09);
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.13);

  // 瞬态：高频白噪声，给"啵"的脆感
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1400;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.22, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  src.connect(hp);
  hp.connect(ng);
  ng.connect(ctx.destination);
  src.start(t);
}

type Particle = { id: number; cell: number; dx: number; dy: number; color: string; size: number };

export default function VentPage() {
  const router = useRouter();
  const [popped, setPopped] = useState<Set<number>>(new Set());
  const [round, setRound] = useState(1);
  const [particles, setParticles] = useState<Particle[]>([]);
  const pidRef = useRef(0);

  const pop = (i: number) => {
    if (popped.has(i)) return;
    playPop();
    // 震动反馈（安卓支持；iOS Safari 无此 API 自动跳过）
    try {
      navigator.vibrate?.(18);
    } catch {}

    // 破裂粒子
    const items: Particle[] = Array.from({ length: 7 }, () => ({
      id: (pidRef.current += 1),
      cell: i,
      dx: (Math.random() - 0.5) * 84,
      dy: (Math.random() - 0.5) * 84 - 18,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      size: 4 + Math.random() * 6,
    }));
    setParticles((prev) => [...prev, ...items]);
    const ids = new Set(items.map((it) => it.id));
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 500);

    setPopped((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  };

  const reset = () => {
    setPopped(new Set());
    setParticles([]);
    setRound((r) => r + 1);
  };

  const done = popped.size >= TOTAL;
  const progress = Math.round((popped.size / TOTAL) * 100);

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
          <p className="text-[11px] text-text-tertiary">想捏就捏，把烦心事都捏破</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary">
          {popped.size}/{TOTAL}
        </span>
      </header>

      {/* 进度条 */}
      <div className="px-4 pt-3">
        <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5B9DFF] to-[#7BB0FF] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 泡泡纸 */}
      <div className="relative flex-1 px-3 py-4">
        <div
          className="mx-auto grid max-w-md select-none gap-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: TOTAL }, (_, i) => {
            const isPopped = popped.has(i);
            const floatDelay = (i % 7) * 0.35;
            const floatDur = 2.6 + (i % 5) * 0.4;
            return (
              <button
                key={`${round}-${i}`}
                onClick={() => pop(i)}
                disabled={isPopped}
                aria-label={isPopped ? "已捏破" : `捏破第 ${i + 1} 个泡泡`}
                className="relative aspect-square"
              >
                {/* 未破：立体泡泡（内层做漂浮动画 + 高光） */}
                {!isPopped && (
                  <span
                    className="vent-bubble absolute inset-0 block"
                    style={{ animationDelay: `${floatDelay}s`, animationDuration: `${floatDur}s` }}
                  >
                    <span className="vent-bubble-pop absolute inset-0 block cursor-pointer rounded-full bg-[radial-gradient(circle_at_32%_26%,#ffffff_0%,#e4edff_30%,#bcd3fc_65%,#93baf7_100%)] shadow-[0_4px_10px_rgba(91,157,255,0.3),inset_0_-3px_6px_rgba(91,157,255,0.28)] transition-transform duration-100 active:scale-75 dark:bg-[radial-gradient(circle_at_32%_26%,#46587a_0%,#2f3e5c_32%,#26334e_66%,#1e2a41_100%)] dark:shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_-3px_6px_rgba(0,0,0,0.35)]">
                      <span className="pointer-events-none absolute left-[22%] top-[16%] h-[22%] w-[30%] rounded-full bg-white/70 blur-[1px] dark:bg-white/25" />
                    </span>
                  </span>
                )}
                {/* 已破：瘪掉的泡泡皮 */}
                {isPopped && (
                  <motion.span
                    initial={{ scale: 1.35, opacity: 0.9 }}
                    animate={{ scale: 0.9, opacity: 1 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="absolute inset-0 block cursor-default rounded-full bg-surface-muted shadow-[inset_0_3px_8px_rgba(0,0,0,0.22)] dark:bg-[#151d2e]"
                  >
                    <span className="pointer-events-none absolute left-[30%] top-[26%] h-[18%] w-[24%] rounded-full bg-white/20 blur-[1px]" />
                  </motion.span>
                )}
                {/* 破裂粒子 */}
                {particles
                  .filter((p) => p.cell === i)
                  .map((p) => (
                    <span
                      key={p.id}
                      className="vent-particle"
                      style={
                        {
                          "--dx": `${p.dx}px`,
                          "--dy": `${p.dy}px`,
                          background: p.color,
                          width: p.size,
                          height: p.size,
                        } as React.CSSProperties
                      }
                    />
                  ))}
              </button>
            );
          })}
        </div>

        {/* 全部捏完的庆祝层 */}
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={easeStandard}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm"
          >
            <motion.span
              initial={{ scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="text-[44px]"
            >
              🎉
            </motion.span>
            <p className="mt-3 font-display text-[20px] font-bold text-text">爽！全捏完了</p>
            <p className="mt-1.5 text-[13px] text-text-secondary">烦恼碎了一地。还想捏吗？</p>
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
        开着声音捏更爽 · 手机记得调媒体音量
      </p>
    </div>
  );
}
