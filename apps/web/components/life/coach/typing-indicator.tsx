"use client";

import { motion } from "framer-motion";

/**
 * AI 正在输入指示器: 三个跳动的圆点, 用于对话等待状态.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-[16px] rounded-bl-[4px] bg-surface-muted px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-muted"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
