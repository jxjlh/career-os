"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

import { recommendBucketItems } from "@/lib/bucket";
import { Badge, Skeleton } from "@/components/ui";

export function AiRecommendation() {
  const query = useQuery({
    queryKey: ["bucket-recommendation"],
    queryFn: () =>
      recommendBucketItems({
        // 占位画像: 真实场景由用户档案注入; 此处给合理默认让首屏有内容
        career: "工程师",
        interests: ["旅行", "摄影", "成长"],
        budget: "10000-30000",
        city: "上海",
      }),
    staleTime: 5 * 60 * 1000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-44 shrink-0 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  const data = query.data;
  if (!data || data.recommendations.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ai/15">
            <Sparkles className="h-3.5 w-3.5 text-ai" />
          </span>
          <h2 className="text-base font-semibold">猜你喜欢</h2>
          <Badge variant={data.source === "ai" ? "ai" : "default"}>
            {data.source === "ai" ? "AI 智能匹配" : "热门推荐"}
          </Badge>
        </div>
        <span className="text-[11px] text-muted">基于你的画像与历史</span>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.recommendations.map((rec, idx) => (
          <motion.div
            key={rec.itemId}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx * 0.06, 0.4) }}
            className="w-44 shrink-0"
          >
            <Link href={`/life/bucket/${rec.itemId}`}>
              <div className="overflow-hidden rounded-[14px] border border-border bg-surface transition-shadow hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)]">
                <div className="relative aspect-[4/3] w-full bg-surface-muted">
                  {rec.coverImage ? (
                    <img
                      src={rec.coverImage}
                      alt={rec.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/20 to-pink-400/20">
                      <Sparkles className="h-6 w-6 text-primary/40" />
                    </div>
                  )}
                  {/* 匹配度 */}
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {rec.matchScore}%
                  </div>
                  {rec.priority === "high" && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ai px-1.5 py-0.5 text-[9px] font-medium text-white">
                      强烈推荐
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-[13px] font-semibold">{rec.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                    {rec.reason}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
