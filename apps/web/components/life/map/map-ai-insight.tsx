"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Compass, Sparkles } from "lucide-react";

import { getMapInsight } from "@/lib/life-map";
import { Badge, Skeleton } from "@/components/ui";

export function MapAiInsight() {
  const query = useQuery({
    queryKey: ["map-insight"],
    queryFn: getMapInsight,
    staleTime: 5 * 60 * 1000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3 rounded-[16px] border border-ai/20 bg-gradient-to-br from-ai/5 to-transparent p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-[16px] border border-ai/20 bg-gradient-to-br from-ai/5 to-transparent p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ai/15">
          <Sparkles className="h-3.5 w-3.5 text-ai" />
        </span>
        <h2 className="text-base font-semibold">AI 足迹洞察</h2>
        <Badge variant={data.source === "ai" ? "ai" : "default"}>
          {data.source === "ai" ? "AI 生成" : "智能回退"}
        </Badge>
      </div>

      {data.summary && <p className="text-[13px] leading-relaxed text-text">{data.summary}</p>}

      {data.highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.highlights.map((h, i) => (
            <span key={i} className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] text-text">
              {h}
            </span>
          ))}
        </div>
      )}

      {data.nextStop?.title && (
        <div className="flex items-start gap-2 rounded-[10px] bg-surface p-3">
          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-[12px] font-medium">下一站推荐: {data.nextStop.title}</p>
            {data.nextStop.reason && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{data.nextStop.reason}</p>
            )}
          </div>
        </div>
      )}

      {data.suggestions.length > 0 && (
        <ul className="space-y-1 pl-4">
          {data.suggestions.map((s, i) => (
            <li key={i} className="text-[12px] text-muted">
              · {s}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
