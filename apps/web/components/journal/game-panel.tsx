"use client";

import { motion } from "framer-motion";

import type { CompanionGame } from "@/lib/ai/journal-companion";
import { easeStandard } from "@/lib/motion";

// ── 游戏选择器 ────────────────────────────────────────────────────────
export function GamePicker({
  games,
  onPick,
  loading,
}: {
  games: CompanionGame[];
  onPick: (game: CompanionGame) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[74px] animate-pulse rounded-[14px] bg-surface-elevated/60"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {games.map((game) => (
        <motion.button
          key={game.id}
          onClick={() => onPick(game)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeStandard}
          className="flex flex-col items-start gap-1 rounded-[14px] border border-border-subtle bg-surface px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-surface-elevated"
        >
          <span className="text-[20px] leading-none">{game.emoji}</span>
          <span className="text-[13px] font-medium text-text">{game.title}</span>
          <span className="text-[10px] leading-snug text-text-tertiary">{game.desc}</span>
        </motion.button>
      ))}
    </div>
  );
}

// ── 游戏舞台（视觉 + 操作） ───────────────────────────────────────────
export function GameStage({
  game,
  step,
  done,
  round,
  onNext,
  onRestart,
  onExit,
}: {
  game: CompanionGame;
  /** 当前展示的步骤下标（guided），或已进行轮数（text） */
  step: number;
  done: boolean;
  round: number;
  onNext: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const totalSteps = game.steps?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-[16px] border border-border-subtle bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-text">
            <span className="text-[16px] leading-none">{game.emoji}</span>
            {game.title}
          </span>
          <button
            onClick={onExit}
            className="rounded-full px-2.5 py-1 text-[11px] text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-secondary"
          >
            换一个
          </button>
        </div>

        {game.id === "balloon" && <BalloonVisual stage={step} released={done} />}
        {game.id === "treasure" && <TreasureVisual step={step} total={totalSteps} done={done} />}
        {game.id === "punchbag" && <PunchVisual round={round} />}
        {game.id === "trash" && <TrashVisual round={round} />}

        {game.kind === "guided" && !done && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${Math.round(((step + 1) / totalSteps) * 100)}%` }}
                  transition={easeStandard}
                />
              </div>
            </div>
            <button
              onClick={onNext}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {game.steps?.[step]?.cta ?? "下一步"}
            </button>
          </div>
        )}

        {done && (
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 text-[11px] text-text-tertiary">
              这一轮结束了，感觉怎么样？
            </span>
            <button
              onClick={onRestart}
              className="shrink-0 rounded-full border border-border-subtle bg-surface px-4 py-2 text-[12px] text-text transition-colors hover:bg-surface-elevated"
            >
              再来一次
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 各游戏的可视化 ────────────────────────────────────────────────────

/** 吹气球：随步骤变大，松手后飘走 */
function BalloonVisual({ stage, released }: { stage: number; released: boolean }) {
  const size = 34 + Math.min(stage, 3) * 16;
  return (
    <div className="relative flex h-[124px] items-center justify-center overflow-hidden">
      <motion.div
        animate={
          released
            ? { y: -130, x: 34, opacity: 0, rotate: 12 }
            : { y: 0, x: 0, opacity: 1, rotate: 0 }
        }
        transition={{ duration: released ? 2.2 : 0.5, ease: "easeInOut" }}
        className="flex flex-col items-center"
      >
        <span style={{ fontSize: size }} className="leading-none">
          🎈
        </span>
        {!released && <span className="mt-1 h-6 w-px bg-border-subtle" />}
      </motion.div>
      {released && (
        <span className="absolute bottom-2 text-[11px] text-text-tertiary">
          飞走了 ✨
        </span>
      )}
    </div>
  );
}

/** 视觉寻宝：三轮进度 */
function TreasureVisual({ step, total, done }: { step: number; total: number; done: boolean }) {
  const labels = ["红", "蓝", "舒服的"];
  return (
    <div className="flex h-[124px] flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-3">
        {Array.from({ length: total }).map((_, i) => {
          const cleared = i < step;
          const active = i === step && !done;
          return (
            <motion.div
              key={i}
              animate={{ scale: active ? 1.08 : 1 }}
              transition={easeStandard}
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-[12px] font-medium transition-colors ${
                cleared
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : active
                    ? "border-primary bg-surface text-text"
                    : "border-border-subtle bg-surface-elevated/50 text-text-tertiary"
              }`}
            >
              {cleared ? "✓" : labels[i] ?? i + 1}
            </motion.div>
          );
        })}
      </div>
      <p className="text-[11px] text-text-tertiary">
        {done ? "全部找到啦 🌿" : "找一个，点一下"}
      </p>
    </div>
  );
}

/** 沙袋：击打计数 */
function PunchVisual({ round }: { round: number }) {
  return (
    <div className="flex h-[124px] items-center justify-center gap-4">
      <motion.span
        key={round}
        animate={{ rotate: [0, -16, 14, 0], scale: [1, 1.14, 1] }}
        transition={{ duration: 0.45 }}
        className="text-[46px] leading-none"
      >
        🥊
      </motion.span>
      <div className="text-left">
        <p className="font-display text-[26px] font-semibold leading-none text-text">
          {round}
        </p>
        <p className="mt-1 text-[11px] text-text-tertiary">下，都接住了</p>
      </div>
    </div>
  );
}

/** 情绪垃圾桶：粉碎计数 */
function TrashVisual({ round }: { round: number }) {
  return (
    <div className="flex h-[124px] items-center justify-center gap-4">
      <motion.span
        key={round}
        animate={{ scale: [1, 0.82, 1.06, 1], opacity: [1, 0.6, 1] }}
        transition={{ duration: 0.55 }}
        className="text-[46px] leading-none"
      >
        🗑️
      </motion.span>
      <div className="text-left">
        <p className="font-display text-[26px] font-semibold leading-none text-text">
          {round}
        </p>
        <p className="mt-1 text-[11px] text-text-tertiary">件，已扔进赛博黑洞</p>
      </div>
    </div>
  );
}
