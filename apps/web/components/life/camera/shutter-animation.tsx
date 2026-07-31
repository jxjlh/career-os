"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * 拍照快门动画: 全屏白闪 + 缩放.
 * 由 `flash` prop 控制, 持续 350ms 后自动隐藏 (由父组件控制 flash=false).
 */
export function ShutterAnimation({ flash }: { flash: boolean }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 bg-white"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}

/** 录像录制中的红色脉冲指示器 (用于快门按钮上的红点). */
export function RecordingPulse({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <motion.span
      className="absolute inset-0 rounded-full bg-red-500"
      animate={{ opacity: [0.8, 0.4, 0.8] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
