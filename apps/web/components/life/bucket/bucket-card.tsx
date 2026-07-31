"use client";

import { motion } from "framer-motion";
import { Check, Heart, MapPin } from "lucide-react";
import Link from "next/link";

import type { BucketItem } from "@/lib/bucket";
import { categoryColor, difficultyLabel } from "@/lib/bucket";
import { cn } from "@career-os/utils";

const COVER_FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
];

function gradientFor(id: string): string {
  const idx = id.charCodeAt(0) % COVER_FALLBACK_GRADIENTS.length;
  return COVER_FALLBACK_GRADIENTS[idx];
}

export function BucketCard({ item, index = 0 }: { item: BucketItem; index?: number }) {
  const joined = item.userState?.joined;
  const completed = item.userState?.completed;
  const favorite = item.userState?.favorite;
  const accent = categoryColor(item.tags?.[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      className="group break-inside-avoid"
    >
      <Link href={`/life/bucket/${item.id}`}>
        <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
          {/* 封面 */}
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[3/4]">
            {item.coverImage ? (
              <img
                src={item.coverImage}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: gradientFor(item.id) }}
              >
                <span className="px-4 text-center text-2xl font-bold text-white/90 drop-shadow-sm">
                  {item.title}
                </span>
              </div>
            )}

            {/* 顶部状态徽章 */}
            <div className="absolute left-2.5 top-2.5 flex gap-1.5">
              {completed && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {favorite && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                </span>
              )}
            </div>

            {/* 分类色条 */}
            <span
              className="absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur"
              style={{ backgroundColor: accent + "cc" }}
            >
              {difficultyLabel(item.difficulty)}
            </span>

            {/* 底部渐变遮罩 + 标题 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pt-10">
              <h3 className="text-[15px] font-semibold leading-snug text-white">{item.title}</h3>
              {item.subtitle && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/75">{item.subtitle}</p>
              )}
            </div>
          </div>

          {/* 底部信息 */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
              {item.country || item.city ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {[item.country, item.city].filter(Boolean).join(" · ")}
                  </span>
                </>
              ) : (
                <span>{item.tags?.[0] ?? "人生体验"}</span>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                joined ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted",
              )}
            >
              {completed ? "已完成" : joined ? "已加入" : `${item.completedCount} 人完成`}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
