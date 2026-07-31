"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, Textarea, cn } from "@/components/ui";
import {
  deleteMemory,
  MEMORY_TYPE_LABELS,
  updateMemory,
  type MemoryItem,
} from "@/lib/coach";

interface MemoryCardProps {
  memory: MemoryItem;
  index?: number;
}

/**
 * 长期记忆卡片: 展示 AI 自动提取的用户画像, 支持内联编辑与删除.
 * 重要度用条形进度可视化 (1~10).
 */
export function MemoryCard({ memory, index = 0 }: MemoryCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const [importance, setImportance] = useState(memory.importance);

  const updateMutation = useMutation({
    mutationFn: (payload: { content?: string; importance?: number }) =>
      updateMemory(memory.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-memory"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemory(memory.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-memory"] }),
  });

  const label = MEMORY_TYPE_LABELS[memory.memoryType] || memory.memoryType;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-[14px] border border-border bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {label}
        </span>
        {!editing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="编辑记忆"
              onClick={() => {
                setDraft(memory.content);
                setImportance(memory.importance);
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted hover:text-danger"
              aria-label="删除记忆"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="text-sm"
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
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={updateMutation.isPending || !draft.trim()}
              onClick={() =>
                updateMutation.mutate({ content: draft.trim(), importance })
              }
            >
              保存
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-text">{memory.content}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  memory.importance >= 7
                    ? "bg-primary"
                    : memory.importance >= 4
                      ? "bg-primary/60"
                      : "bg-muted",
                )}
                style={{ width: `${memory.importance * 10}%` }}
              />
            </div>
            <span className="text-[11px] text-muted">{memory.importance}/10</span>
          </div>
        </>
      )}
    </motion.div>
  );
}
