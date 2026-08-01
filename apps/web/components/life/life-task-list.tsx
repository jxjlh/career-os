"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ListChecks, Loader2 } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { completeLifeTask, getLifeGoalTasks, reopenLifeTask, type LifeTask } from "@/lib/life";

const TASK_TYPE_LABEL: Record<string, string> = {
  daily: "每日",
  weekly: "每周",
  phase: "阶段",
};

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function isOverdue(task: LifeTask, today = new Date()): boolean {
  if (!task.dueDate || task.status === "done") return false;
  const due = new Date(task.dueDate);
  return !Number.isNaN(due.getTime()) && due < today;
}

export function LifeTaskList({ goalId }: { goalId: string }) {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({
    queryKey: ["life-goal-tasks", goalId],
    queryFn: () => getLifeGoalTasks(goalId),
  });

  const toggleMutation = useMutation({
    mutationFn: (task: LifeTask) =>
      task.status === "done" ? reopenLifeTask(task.id) : completeLifeTask(task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["life-goal-tasks", goalId] });
      // 任务完成情况影响 AI 助手与年度报告的上下文, 一并失效
      void queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["daily-assistant"] });
    },
  });

  if (tasksQuery.isLoading) return <Skeleton className="h-40" />;
  if (tasksQuery.isError) {
    return (
      <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface p-4">
        <span className="text-sm text-muted">任务加载失败</span>
        <Button variant="outline" size="sm" onClick={() => tasksQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const list = tasksQuery.data ?? [];
  const total = list.length;
  const done = list.filter((task) => task.status === "done").length;
  const progress = total > 0 ? Math.round((done * 100) / total) : 0;

  if (total === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">成长任务</h2>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <ListChecks className="h-5 w-5 text-muted" />
          <p className="text-sm font-medium">还没有成长任务</p>
          <p className="max-w-sm text-[13px] text-muted">任务生成后会显示在这里。</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">成长任务</h2>
          <span className="text-xs text-muted">
            {done}/{total} 已完成
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {list.map((task) => {
          const isDone = task.status === "done";
          const overdue = isOverdue(task);
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-[8px] border border-border bg-surface p-3 transition-colors hover:border-primary/30"
            >
              <button
                type="button"
                aria-label={isDone ? "标记为未完成" : "标记为已完成"}
                disabled={toggleMutation.isPending}
                onClick={() => toggleMutation.mutate(task)}
                className={[
                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors",
                  isDone
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-transparent hover:border-primary",
                ].join(" ")}
              >
                {toggleMutation.isPending && toggleMutation.variables?.id === task.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    "text-sm",
                    isDone ? "text-muted line-through" : "text-text",
                  ].join(" ")}
                >
                  {task.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge>{TASK_TYPE_LABEL[task.taskType] ?? task.taskType}</Badge>
                  {task.dueDate && (
                    <span className={overdue ? "text-danger" : ""}>
                      {overdue ? "已逾期 · " : ""}
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  {isDone && task.completedAt && (
                    <span className="text-success">完成于 {formatDate(task.completedAt)}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

    </Card>
  );
}
