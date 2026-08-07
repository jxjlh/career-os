"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  ActiveGoals,
  Hero,
  LifeMapPreview,
  LifeStats,
  StreakCard,
  WeeklyPlanProgress,
} from "@/components/dashboard";
import { journalApi } from "@/lib/journal";

type Envelope = { data: any };

/**
 * CareerOS Dashboard —— 年轻人的人生操作系统首页。
 *
 * 取代传统 StatCard grid + EChart + calendar 的 Dashboard 表达，
 * 改用 Hero / Streak / ActiveGoals / LifeMap / Mood / LifeStats 六段式叙事。
 *
 * 不破坏现有功能：
 *  - onboarding 引导卡片保留
 *  - /dashboard/ai-advice 保留为底部轻量 AI 提示（不再做成 Card）
 *  - /dashboard/summary / trends / calendar API 不动，仅在首页不再展示
 *    （trend/calendar 数据已在 /analytics 页面展示，非删除功能）
 */
export default function DashboardPage() {
  const onboarding = useQuery<Envelope>({
    queryKey: ["onboarding-status"],
    queryFn: () => apiFetch("/onboarding/status"),
  });
  const advice = useQuery<Envelope>({
    queryKey: ["dashboard-advice"],
    queryFn: () => apiFetch("/dashboard/ai-advice"),
  });

  return (
    <div className="space-y-1">
      {/* onboarding 引导 —— 保留功能 */}
      {onboarding.data?.data && !onboarding.data.data.completed && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-text">完成引导，让 AI 为你生成路线与计划</p>
            <p className="mt-0.5 text-[12px] text-text-tertiary">只需要 2 分钟。</p>
          </div>
          <a href="/onboarding">
            <Button size="sm" variant="primary">
              开始引导
            </Button>
          </a>
        </div>
      )}

      {/* 1. Hero —— 动态问候 + 人生格言 */}
      <Hero />

      {/* 2. Streak —— 连续打卡 */}
      <StreakCard />

      {/* 3. Active Goals —— 轻量 Row 列表 */}
      <ActiveGoals />

      {/* 4. Weekly Plan Progress —— 本周计划进度 (AI 周计划入口) */}
      <WeeklyPlanProgress />

      {/* 5. Life Map —— 人生轨迹预览 */}
      <LifeMapPreview />

      {/* 6. Mood → Journal 入口 */}
      <JournalEntry />

      {/* 7. Life Stats —— 杂志排版数字 */}
      <LifeStats />

      {/* 7. AI 提示 —— 保留功能，极轻量，不再做成 Card */}
      {advice.data?.data?.advice && (
        <section className="mt-12 border-t border-border-subtle/60 pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-ai" />
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              AI WHISPER
            </span>
          </div>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-secondary">
            {advice.data.data.advice}
          </p>
        </section>
      )}
    </div>
  );
}

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;

/**
 * Journal Entry —— Dashboard 上的小记入口卡片.
 * 显示今天是否已记录心情, 可点击跳转到 /journal
 */
function JournalEntry() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<{ data: { moodIndex: number } | null }>({
    queryKey: ["journal", todayStr],
    queryFn: () => journalApi.getByDate(todayStr),
    staleTime: 0,
  });

  const journal = data?.data;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            TODAY&apos;S MOOD
          </h2>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {journal ? "今天还不错" : "How are you feeling?"}
          </p>
        </div>
        <Link
          href="/journal"
          className="text-[12px] text-text-tertiary transition-colors hover:text-text-secondary"
        >
          {journal ? "查看/编辑 →" : "开始记录 →"}
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {MOOD_EMOJIS.map((m, i) => (
          <span
            key={m}
            className={`flex h-11 w-11 items-center justify-center rounded-[12px] text-xl
              ${journal?.moodIndex === i
                ? "bg-primary/12 ring-1 ring-primary/40"
                : "bg-surface/40 opacity-50"
              }
            `}
          >
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}
