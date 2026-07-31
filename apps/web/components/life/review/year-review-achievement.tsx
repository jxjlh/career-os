"use client";

import { motion } from "framer-motion";

const ACHIEVEMENT_ICONS = ["🏆", "🌍", "📚", "💪", "✨", "🚀", "🎯", "❤️", "💰"];

/** 将单条成就文本拆分为 标题 + 描述: 以首个中文/英文标点切分, 无标点则整段为标题. */
function splitAchievement(text: string): { title: string; description?: string } {
  const match = text.match(/^([^，,。.；;:：]+)[，,。.；;:：]?\s*(.*)$/);
  if (match && match[2]) {
    return { title: match[1].trim(), description: match[2].trim() };
  }
  return { title: text };
}

/**
 * 成就墙: AI 返回多少成就就渲染多少张卡片. 每张卡循环分配 emoji 图标,
 * 进入时错峰 fade + slide, hover 时上浮并轻微放大.
 */
export function YearReviewAchievement({ achievements }: { achievements: string[] }) {
  if (!achievements || achievements.length === 0) return null;

  return (
    <section>
      <motion.h3
        initial={{ opacity: 0, x: -8 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4 }}
        className="mb-3 text-sm font-semibold text-muted"
      >
        我的成就
      </motion.h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {achievements.map((item, index) => {
          const { title, description } = splitAchievement(item);
          return (
            <motion.div
              key={`${title}-${index}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.36) }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="group flex items-start gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-primary/40"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-gradient-to-br from-amber-400/15 to-orange-500/10 text-xl">
                {ACHIEVEMENT_ICONS[index % ACHIEVEMENT_ICONS.length]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{title}</p>
                {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
