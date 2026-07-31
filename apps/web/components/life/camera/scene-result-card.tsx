"use client";

import { motion } from "framer-motion";
import { Sparkles, Tag } from "lucide-react";

import { Badge } from "@/components/ui";
import type { PhotoAnalysisResponse } from "@/lib/life";

const SCENE_LABEL: Record<string, string> = {
  travel: "🌍 旅行",
  food: "🍽️ 美食",
  nature: "🌿 自然",
  city: "🏙️ 城市",
  sport: "🏃 运动",
  family: "👨‍👩‍👧 家人",
  work: "💼 工作",
  learning: "📚 学习",
  celebration: "🎉 庆祝",
  daily: "🌅 日常",
  pet: "🐾 萌宠",
  other: "✨ 其他",
};

interface SceneResultCardProps {
  result: PhotoAnalysisResponse | null;
  loading?: boolean;
}

/**
 * AI 场景识别结果卡片: 场景类型 / 标签 / 描述 / 关联 Bucket / 关联目标.
 * 含 source 标记 (ai / fallback) 与加载骨架.
 */
export function SceneResultCard({ result, loading }: SceneResultCardProps) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-[12px] border border-border bg-surface p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-muted" />
      </div>
    );
  }
  if (!result) return null;

  const sceneLabel = result.sceneType
    ? SCENE_LABEL[result.sceneType] ?? result.sceneType
    : "✨ 场景";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 rounded-[12px] border border-ai/30 bg-gradient-to-br from-ai/5 to-transparent p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <span className="text-sm font-semibold">AI 场景识别</span>
        </div>
        <Badge variant={result.source === "ai" ? "ai" : "default"}>
          {result.source === "ai" ? "AI" : "智能推断"}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-base font-medium">{sceneLabel}</span>
      </div>

      {result.description && (
        <p className="text-[13px] leading-relaxed text-muted">{result.description}</p>
      )}

      {result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {(result.relatedBuckets.length > 0 || result.relatedGoals.length > 0) && (
        <div className="space-y-1 border-t border-border pt-2">
          {result.relatedGoals.map((g) => (
            <div key={g.goalId} className="flex items-start gap-1.5 text-xs">
              <span className="text-muted">🎯</span>
              <span className="text-text">{g.title}</span>
              {g.reason && <span className="text-muted">— {g.reason}</span>}
            </div>
          ))}
          {result.relatedBuckets.map((b) => (
            <div key={b.bucketId} className="flex items-start gap-1.5 text-xs">
              <span className="text-muted">🌟</span>
              <span className="text-text">{b.title}</span>
              {b.reason && <span className="text-muted">— {b.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {result.suggestedRecord && (
        <div className="rounded-[8px] bg-surface p-2.5">
          <p className="mb-1 text-xs font-medium text-ai">建议记录</p>
          <p className="text-xs leading-relaxed text-muted">{result.suggestedRecord.content}</p>
        </div>
      )}
    </motion.div>
  );
}
