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
import { journalApi, TIME_SLOTS } from "@/lib/journal";

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
 * 显示今天各个时间段的心情记录, 可视化为时间线.
 */
function JournalEntry() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<{ data: { moodIndex: number; timeSlot: string; content?: string }[] }>({
    queryKey: ["journal", todayStr],
    queryFn: () => journalApi.getByDate(todayStr),
    staleTime: 0,
  });

  const entries = data?.data ?? [];
  const recordedCount = entries.length;
  const avgMood = recordedCount > 0
    ? Math.round(entries.reduce((sum, e) => sum + e.moodIndex, 0) / recordedCount)
    : null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            TODAY&apos;S MOOD
          </h2>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {recordedCount > 0
              ? `今天已记录 ${recordedCount} 个时间段`
              : "How are you feeling?"}
          </p>
        </div>
        <Link
          href="/journal"
          className="text-[12px] text-text-tertiary transition-colors hover:text-text-secondary"
        >
          {recordedCount > 0 ? "查看/编辑 →" : "开始记录 →"}
        </Link>
      </div>

      {/* 时间段可视化 */}
      <div className="mt-3 flex items-center gap-1.5">
        {TIME_SLOTS.map((slot) => {
          const entry = entries.find((e) => e.timeSlot === slot.key);
          return (
            <Link
              key={slot.key}
              href="/journal"
              className="group relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-200 hover:bg-surface/40"
              title={entry ? `${slot.label}: ${entry.content || "已记录"}` : `${slot.label}: 未记录`}
            >
              {/* 时间段图标 */}
              <span className={`text-base transition-opacity ${entry ? "opacity-100" : "opacity-30"}`}>
                {slot.icon}
              </span>
              {/* 心情 emoji 或空圆点 */}
              {entry ? (
                <span className="text-sm">{MOOD_EMOJIS[entry.moodIndex]}</span>
              ) : (
                <span className="h-2 w-2 rounded-full border border-white/15" />
              )}
              {/* 时间段标签 */}
              <span className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">
                {slot.label}
              </span>
              {/* 已记录指示线 */}
              <div
                className={`absolute -bottom-px h-0.5 w-full rounded-full transition-colors ${
                  entry ? "bg-primary/40" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>

      {/* 平均心情 */}
      {avgMood !== null && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-text-tertiary">
          <span>平均心情</span>
          <span className="text-sm">{MOOD_EMOJIS[avgMood]}</span>
        </div>
      )}
    </section>
  );
}
