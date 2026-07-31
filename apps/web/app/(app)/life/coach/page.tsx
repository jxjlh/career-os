"use client";

import { Brain, History, MessageCircle, Notebook } from "lucide-react";
import Link from "next/link";

import { CoachHero } from "@/components/life/coach/coach-hero";
import { CoachTaskList } from "@/components/life/coach/coach-task-list";
import { CoachTrend } from "@/components/life/coach/coach-trend";
import { SectionHeader } from "@/components/ui";

/**
 * Life AI Coach 首页: AI LifeOS 统一入口.
 * Hero: 今日建议 / 今日提醒 / 问候.
 * 今日任务: 来自 coach_tasks (完成 / 延期 / 删除).
 * 成长趋势: XP / 等级 / 连续打卡 / 目标完成率.
 */
export default function CoachHomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Life AI Coach" subtitle="你的长期人生教练" />
        <div className="flex gap-1">
          <Link href="/life/coach/chat">
            <span className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted hover:text-text">
              <MessageCircle className="h-4 w-4" />
            </span>
          </Link>
          <Link href="/life/coach/history">
            <span className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted hover:text-text">
              <History className="h-4 w-4" />
            </span>
          </Link>
          <Link href="/life/coach/memory">
            <span className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted hover:text-text">
              <Notebook className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>

      <CoachHero />

      {/* 成长趋势 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">成长趋势</h2>
        <CoachTrend />
      </section>

      {/* 今日任务 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">今日任务</h2>
        <CoachTaskList />
      </section>

      {/* 导航入口 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/life/coach/chat"
          className="flex items-center justify-between rounded-[12px] border border-border bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4 text-violet-500" />
            AI 对话
          </span>
          <span className="text-xs text-muted">聊聊 →</span>
        </Link>
        <Link
          href="/life/coach/history"
          className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-primary" />
            历史会话
          </span>
          <span className="text-xs text-muted">查看 →</span>
        </Link>
        <Link
          href="/life/coach/memory"
          className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Notebook className="h-4 w-4 text-primary" />
            长期记忆
          </span>
          <span className="text-xs text-muted">管理 →</span>
        </Link>
      </div>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[12px] text-muted">
        <Brain className="h-3.5 w-3.5" />
        AI 教练结合你的 Life Goal / Bucket / Task / Record / Map / Achievement 全量数据
      </p>
    </div>
  );
}
