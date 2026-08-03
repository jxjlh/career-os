/**
 * Motion —— CareerOS 共享动画系统
 *
 * 原则：
 *  - 所有动画 150-300ms，ease-out
 *  - 不夸张，subtle but deliberate
 *  - 支持 prefers-reduced-motion（无障碍）
 *
 * 复用：Sidebar / Hero / Streak / Goals / Mood / Map / Button / Page transition
 */

import { useEffect, useRef, useState } from "react";

// ── Transition Presets ───────────────────────────────────────────────
/** 快速反馈 150ms（hover / tap / icon 状态） */
export const easeFast = { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const };
/** 标准过渡 220ms（默认，多数 UI 元素） */
export const easeStandard = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };
/** 进入动画 280ms（首屏 / 列表 stagger） */
export const easeEnter = { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const };
/** 弹性反馈（小范围 scale，如 streak 数字） */
export const easePop = { type: "spring" as const, stiffness: 320, damping: 22, mass: 0.6 };

// ── Variants ────────────────────────────────────────────────────────
/** 上浮淡入 —— 默认初始态隐藏，避免 SSR 闪烁 */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeStandard },
};

/** 纯淡入 */
export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeFast },
};

/** 从左滑入（goal row / 列表项） */
export const slideInLeft = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: easeStandard },
};

/** stagger 容器 —— 子元素依次进入 */
export const staggerContainer = (stagger = 0.05, delayChildren = 0.04) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

// ── Hooks ───────────────────────────────────────────────────────────

/**
 * useReducedMotion —— 检测用户是否偏好减少动画。
 * 静态化所有 motion（直接到终态，无 transition）。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/**
 * useMagneticHover —— 按钮 magnetic 感（鼠标在元素上轻微跟随）。
 * 用于关键 CTA（primary button / icon button）。
 *
 * 用法：
 *   const ref = useMagneticHover<HTMLButtonElement>();
 *   <button ref={ref} />
 *
 * 实现：监听 mousemove，translate ≤ 4px，离开时弹回。
 * reduced-motion 时禁用。
 */
export function useMagneticHover<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    let rafId = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      // 限制最大位移 4px，subtle
      const dx = Math.max(-4, Math.min(4, x * 0.15));
      const dy = Math.max(-4, Math.min(4, y * 0.15));
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(rafId);
      el.style.transform = "";
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  return ref;
}

/**
 * useTaskCompleteFeedback —— 完成任务时的 glow / particle feedback。
 * 返回 trigger 函数 + 是否在播放动画。
 *
 * 用法：
 *   const { playing, trigger } = useTaskCompleteFeedback();
 *   <button onClick={trigger} className={playing ? "ring-glow" : ""} />
 *
 * 实现：800ms 后自动复位，无 DOM 副作用。
 * reduced-motion 时直接返回 playing=false（无视觉反馈）。
 */
export function useTaskCompleteFeedback(duration = 800) {
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setPlaying(false), duration);
    return () => clearTimeout(id);
  }, [playing, duration]);

  return {
    playing: reduced ? false : playing,
    trigger: () => !reduced && setPlaying(true),
  };
}
