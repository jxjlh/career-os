"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MemoryCard } from "@/components/life/coach/memory-card";
import { Button, EmptyState, Skeleton, Textarea } from "@/components/ui";
import {
  createMemory,
  listMemory,
  MEMORY_TYPE_LABELS,
} from "@/lib/coach";

/**
 * 长期记忆页: AI 自动提取的用户画像 (目标/兴趣/旅行偏好/职业方向等).
 * 支持查看 / 编辑 (MemoryCard 内联) / 删除, 也可手动新增记忆.
 */
export default function CoachMemoryPage() {
  const queryClient = useQueryClient();
  const memory = useQuery({
    queryKey: ["coach-memory"],
    queryFn: listMemory,
  });

  const [showForm, setShowForm] = useState(false);
  const [memoryType, setMemoryType] = useState<keyof typeof MEMORY_TYPE_LABELS>("goal");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(5);

  const createMutation = useMutation({
    mutationFn: () =>
      createMemory({
        memoryType,
        content: content.trim(),
        importance,
        source: "user",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-memory"] });
      setContent("");
      setImportance(5);
      setShowForm(false);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Link href="/life/coach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-base font-semibold">长期记忆</h1>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      {/* 新增表单 */}
      {showForm && (
        <div className="space-y-3 rounded-[14px] border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MEMORY_TYPE_LABELS) as Array<keyof typeof MEMORY_TYPE_LABELS>).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setMemoryType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    memoryType === t
                      ? "bg-primary text-white"
                      : "border border-border bg-surface text-muted hover:text-text"
                  }`}
                >
                  {MEMORY_TYPE_LABELS[t]}
                </button>
              ),
            )}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="描述这条记忆, 例如: 偏好深度慢游, 喜欢人文与海岛并重"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">重要度</span>
            <input
              type="range"
              min={1}
              max={10}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-6 text-xs font-medium">{importance}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!content.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              保存
            </Button>
          </div>
        </div>
      )}

      {/* 记忆列表 */}
      {memory.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}

      {!memory.isLoading && (memory.data ?? []).length === 0 && (
        <EmptyState
          title="还没有长期记忆"
          description="AI 教练会在对话中自动提取你的目标、兴趣与偏好。你也可以手动新增。"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {(memory.data ?? []).map((mem, idx) => (
            <MemoryCard key={mem.id} memory={mem} index={idx} />
          ))}
        </AnimatePresence>
      </div>

      <p className="pt-2 text-center text-[12px] text-muted">
        AI 教练会在对话中持续学习, 自动提取并更新你的画像。
      </p>
    </div>
  );
}
