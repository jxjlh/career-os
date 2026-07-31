"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, X } from "lucide-react";
import { useState } from "react";

import type { YearReviewResponse } from "@/lib/life";

type Memory = YearReviewResponse["memories"][number];

const GRADIENTS = [
  "from-rose-400/20 to-pink-500/10",
  "from-sky-400/20 to-blue-500/10",
  "from-emerald-400/20 to-teal-500/10",
  "from-amber-400/20 to-orange-500/10",
  "from-fuchsia-400/20 to-purple-500/10",
  "from-indigo-400/20 to-violet-500/10",
];

const DECOR_EMOJI = ["🌸", "🌊", "🍃", "🌅", "🎈", "🏔️", "🍁", "🐚"];

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 记忆墙: Pinterest 风格瀑布流. 当前 year-review 返回的 memories 不含图片 URL,
 * 因此统一渲染为 AI 生成的记忆卡片 (装饰渐变 + 标题/描述/日期). 点击卡片可在弹层中放大查看.
 */
export function YearReviewMemoryWall({ memories }: { memories: YearReviewResponse["memories"] }) {
  const [active, setActive] = useState<Memory | null>(null);

  if (!memories || memories.length === 0) return null;

  return (
    <section>
      <motion.h3
        initial={{ opacity: 0, x: -8 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4 }}
        className="mb-3 text-sm font-semibold text-muted"
      >
        记忆瞬间
      </motion.h3>

      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {memories.map((memory, index) => (
          <motion.button
            type="button"
            key={`${memory.title ?? ""}-${index}`}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.3) }}
            onClick={() => setActive(memory)}
            className="mb-3 block w-full break-inside-avoid rounded-[12px] border border-border bg-surface p-0 text-left transition-colors hover:border-primary/40"
          >
            <div className={`relative h-24 overflow-hidden rounded-t-[12px] bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`}>
              <span className="absolute bottom-2 right-3 text-2xl opacity-70">
                {DECOR_EMOJI[index % DECOR_EMOJI.length]}
              </span>
            </div>
            <div className="p-4">
              <p className="text-sm font-semibold">{memory.title || "人生记录"}</p>
              {memory.description && (
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">{memory.description}</p>
              )}
              {memory.date && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Calendar className="h-3 w-3" />
                  {formatDate(memory.date)}
                </p>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-surface shadow-xl"
            >
              <div className={`relative h-40 bg-gradient-to-br ${GRADIENTS[0]}`}>
                <span className="absolute bottom-4 right-5 text-5xl opacity-70">
                  {DECOR_EMOJI[0]}
                </span>
                <button
                  type="button"
                  aria-label="关闭"
                  onClick={() => setActive(null)}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <h4 className="text-lg font-semibold">{active.title || "人生记录"}</h4>
                {active.description && (
                  <p className="mt-2 text-sm leading-relaxed text-text/80">{active.description}</p>
                )}
                {active.date && (
                  <p className="mt-4 flex items-center gap-1 text-xs text-muted">
                    <Calendar className="h-3 w-3" />
                    {formatDate(active.date)}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
