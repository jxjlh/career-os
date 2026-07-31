"use client";

import { Search, X } from "lucide-react";

import type { BucketSort } from "@/lib/bucket";
import { Button, Input } from "@/components/ui";
import { cn } from "@career-os/utils";

const SORT_OPTIONS: { value: BucketSort; label: string }[] = [
  { value: "popular", label: "热门" },
  { value: "latest", label: "最新" },
  { value: "recommended", label: "推荐" },
];

export interface BucketSearchState {
  q: string;
  sort: BucketSort;
  difficulty: number | undefined;
  completed: boolean | undefined;
}

export function BucketSearchBar({
  value,
  onChange,
}: {
  value: BucketSearchState;
  onChange: (next: BucketSearchState) => void;
}) {
  const patch = (p: Partial<BucketSearchState>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="搜索标题、地点、标签…"
          className="pl-9 pr-9"
        />
        {value.q && (
          <button
            onClick={() => patch({ q: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            aria-label="清除"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 排序 */}
        <div className="flex gap-1 rounded-full bg-surface-muted p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => patch({ sort: opt.value })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                value.sort === opt.value
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted hover:text-text",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 难度筛选 */}
        <select
          value={value.difficulty ?? ""}
          onChange={(e) =>
            patch({ difficulty: e.target.value ? Number(e.target.value) : undefined })
          }
          className="h-8 rounded-full border border-border bg-surface px-3 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">全部难度</option>
          <option value="1">★ 入门</option>
          <option value="2">★★ 轻松</option>
          <option value="3">★★★ 中等</option>
          <option value="4">★★★★ 困难</option>
          <option value="5">★★★★★ 极难</option>
        </select>

        {/* 完成状态 */}
        <div className="flex gap-1">
          <Button
            variant={value.completed === undefined ? "outline" : "ghost"}
            size="sm"
            onClick={() => patch({ completed: undefined })}
            className="h-8 rounded-full px-3 text-xs"
          >
            全部
          </Button>
          <Button
            variant={value.completed === false ? "default" : "outline"}
            size="sm"
            onClick={() => patch({ completed: value.completed === false ? undefined : false })}
            className="h-8 rounded-full px-3 text-xs"
          >
            未完成
          </Button>
          <Button
            variant={value.completed === true ? "default" : "outline"}
            size="sm"
            onClick={() => patch({ completed: value.completed === true ? undefined : true })}
            className="h-8 rounded-full px-3 text-xs"
          >
            已完成
          </Button>
        </div>
      </div>
    </div>
  );
}
