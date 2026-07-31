"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card } from "@/components/ui";
import { cn } from "@career-os/utils";
import type { YearReviewStyle } from "@/lib/life";

const STYLES: Array<{
  key: YearReviewStyle;
  icon: string;
  label: string;
  description: string;
}> = [
  { key: "personal", icon: "🌱", label: "Personal", description: "深度人生复盘" },
  { key: "social", icon: "📱", label: "Social", description: "朋友圈分享" },
  { key: "xiaohongshu", icon: "📖", label: "Xiaohongshu", description: "小红书故事" },
];

export function YearReviewForm({
  onGenerate,
  loading,
}: {
  onGenerate: (year: number, style: YearReviewStyle) => void;
  loading: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const [year, setYear] = useState(currentYear);
  const [style, setStyle] = useState<YearReviewStyle>("personal");

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">选择年份</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {years.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setYear(item)}
            className={cn(
              "rounded-[8px] border px-3 py-1.5 text-sm font-medium transition-colors",
              year === item
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:text-text",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold">选择风格</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {STYLES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setStyle(item.key)}
            className={cn(
              "rounded-[10px] border p-3 text-left transition-colors",
              style === item.key
                ? "border-primary bg-primary/10"
                : "border-border bg-surface hover:border-primary/40",
            )}
          >
            <span className="text-xl">{item.icon}</span>
            <p className="mt-1.5 text-sm font-semibold">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted">{item.description}</p>
          </button>
        ))}
      </div>

      <Button className="mt-5 w-full" onClick={() => onGenerate(year, style)} disabled={loading}>
        <Sparkles className="h-4 w-4" />
        {loading ? "生成中..." : "生成我的年度报告"}
      </Button>
    </Card>
  );
}
