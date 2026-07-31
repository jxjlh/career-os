"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Trash2 } from "lucide-react";

import { Button, EmptyState, Skeleton, cn } from "@/components/ui";
import {
  deleteCoachTask,
  listCoachTasks,
  updateCoachTask,
  type CoachTaskItem,
} from "@/lib/coach";

/**
 * 今日任务列表: 来自 coach_tasks (AI 教练生成的行动建议落地).
 * 支持 完成 / 延期 / 删除, 操作即时反馈并刷新缓存.
 */
export function CoachTaskList() {
  const queryClient = useQueryClient();
  const tasks = useQuery({
    queryKey: ["coach-tasks"],
    queryFn: () => listCoachTasks(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { status?: CoachTaskItem["status"]; priority?: CoachTaskItem["priority"] } }) =>
      updateCoachTask(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCoachTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-tasks"] }),
  });

  if (tasks.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (tasks.isError) {
    return (
      <EmptyState title="任务加载失败" description="请稍后重试" />
    );
  }

  const items = tasks.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="今日还没有任务"
        description="让 AI 教练为你生成今日行动建议吧。"
      />
    );
  }

  // 按状态分组: 待办在前, 已完成在后
  const sorted = [...items].sort((a, b) => {
    const order = { todo: 0, postponed: 1, done: 2 } as const;
    return order[a.status] - order[b.status];
  });

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {sorted.map((task, idx) => {
          const isDone = task.status === "done";
          return (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
              className={cn(
                "flex items-start gap-3 rounded-[12px] border border-border bg-surface p-3",
                isDone && "opacity-60",
              )}
            >
              {/* 完成按钮 */}
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: task.id,
                    payload: { status: isDone ? "todo" : "done" },
                  })
                }
                disabled={updateMutation.isPending}
                aria-label={isDone ? "标记为待办" : "完成任务"}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isDone
                    ? "border-success bg-success text-white"
                    : "border-border hover:border-success",
                )}
              >
                {isDone && <Check className="h-3 w-3" />}
              </button>

              {/* 内容 */}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", isDone && "line-through text-muted")}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="mt-0.5 text-[13px] text-muted">{task.description}</p>
                )}
                {task.dueDate && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                    <Clock className="h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString("zh-CN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* 操作 */}
              <div className="flex shrink-0 items-center gap-1">
                {!isDone && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="延期一天"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        id: task.id,
                        payload: { status: "postponed" },
                      })
                    }
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted hover:text-danger"
                  aria-label="删除任务"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(task.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
