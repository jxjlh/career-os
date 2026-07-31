"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  ListTodo,
  Plane,
  Trophy,
  Flame,
} from "lucide-react";

import { cn } from "@/components/ui";
import {
  REMINDER_SEVERITY_LABELS,
  type CoachReminder,
  type ReminderSeverity,
  type ReminderType,
} from "@/lib/coach";

const REMINDER_ICON: Record<ReminderType, typeof Flame> = {
  streak: Flame,
  overdue: CalendarClock,
  travel: Plane,
  backlog: ListTodo,
  achievement: Trophy,
};

const SEVERITY_STYLE: Record<ReminderSeverity, string> = {
  info: "border-border bg-surface",
  warning: "border-warning/30 bg-warning/5",
  urgent: "border-danger/30 bg-danger/5",
};

const SEVERITY_ICON_COLOR: Record<ReminderSeverity, string> = {
  info: "text-primary",
  warning: "text-warning",
  urgent: "text-danger",
};

interface ReminderListProps {
  reminders: CoachReminder[];
}

/**
 * 主动提醒列表: 根据提醒类型选择图标, 按严重程度着色.
 * 空状态展示"今日无提醒"以维持积极氛围.
 */
export function ReminderList({ reminders }: ReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-border bg-surface p-4 text-sm text-muted">
        <span className="text-base">🎉</span>
        今日无提醒, 保持节奏就好。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {reminders.map((reminder, idx) => {
          const Icon = REMINDER_ICON[reminder.type] || AlertTriangle;
          return (
            <motion.div
              key={`${reminder.type}-${idx}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.05, 0.3) }}
              className={cn(
                "flex items-start gap-3 rounded-[12px] border p-3",
                SEVERITY_STYLE[reminder.severity],
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_ICON_COLOR[reminder.severity])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{reminder.title}</p>
                  <span className="shrink-0 text-[11px] text-muted">
                    {REMINDER_SEVERITY_LABELS[reminder.severity]}
                  </span>
                </div>
                {reminder.detail && (
                  <p className="mt-0.5 text-[13px] text-muted">{reminder.detail}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
