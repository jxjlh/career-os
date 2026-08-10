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
  StreakCard,
  WeeklyPlanProgress,
} from "@/components/dashboard";
import { resolveMediaUrl } from "@/lib/chat";
import { journalApi, TIME_SLOTS, MOODS, type Journal } from "@/lib/journal";

type Envelope = { data: any };

/**
 * CareerOS Dashboard —— 年轻人的人生操作系统首页。
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

      {/* 4. Weekly Plan Progress —— 本周计划进度 */}
      <WeeklyPlanProgress />

      {/* 5. Life Map —— 人生轨迹预览 */}
      <LifeMapPreview />

      {/* 6. Daily Journal —— 每日小记详情 (合并原 TODAY'S MOOD + 每日小记) */}
      <DailyJournal />

      {/* 7. AI 提示 —— 保留功能 */}
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

const MOOD_EMOJIS = MOODS.map((m) => m.emoji);
const MOOD_LABELS = MOODS.map((m) => m.label);

/**
 * DailyJournal —— Dashboard 上的每日小记详情组件.
 * 合并了原 TODAY'S MOOD (时间段可视化) 和 每日小记详情.
 * 只展示每日小记的完整信息.
 */
function DailyJournal() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()];

  const { data, isLoading } = useQuery<{ data: Journal[] }>({
    queryKey: ["journal", todayStr],
    queryFn: () => journalApi.getByDate(todayStr),
    staleTime: 60_000,
  });

  const entries = data?.data ?? [];
  const recordedCount = entries.length;
  const avgMood = recordedCount > 0
    ? Math.round(entries.reduce((sum, e) => sum + e.moodIndex, 0) / recordedCount)
    : null;

  // 找到每个主时段的最新记录
  const getSlotEntry = (slotKey: string) => {
    const slot = TIME_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return null;
    // 查找该主时段下所有子时段的记录，取最新的
    const slotEntries = entries.filter((e) =>
      slot.subSlots.some((ss) => ss.key === e.timeSlot)
    );
    return slotEntries.length > 0 ? slotEntries[slotEntries.length - 1] : null;
  };

  const hasAnyContent = entries.some((e) => e.content && e.content.trim().length > 0);
  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  // 收集所有照片（去重）
  const allPhotos: string[] = [];
  const seenPhotoUrls = new Set<string>();
  for (const e of entries) {
    if (e.photos && e.photos.length > 0) {
      for (const p of e.photos) {
        if (!seenPhotoUrls.has(p)) {
          seenPhotoUrls.add(p);
          allPhotos.push(p);
        }
      }
    }
  }

  return (
    <section className="mt-10">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            每日小记
          </h2>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {today.getMonth() + 1}月{today.getDate()}日 · {weekday}
            {recordedCount > 0 && ` · 已记录 ${recordedCount} 个时段`}
            {allPhotos.length > 0 && ` · ${allPhotos.length} 张照片`}
          </p>
        </div>
        <Link
          href="/journal"
          className="text-[12px] text-primary transition-colors hover:text-primary-glow"
        >
          {recordedCount > 0 ? "编辑详情 →" : "开始记录 →"}
        </Link>
      </div>

      {/* 时间段可视化 + 心情详情 */}
      <div className="mt-3 rounded-xl border border-white/5 bg-surface/30 p-4">
        {/* 时间段心情条 */}
        <div className="flex items-center gap-2">
          {TIME_SLOTS.map((slot) => {
            const entry = getSlotEntry(slot.key);
            const subSlot = entry ? (slot.subSlots.find((ss) => ss.key === entry.timeSlot) ?? slot.subSlots[0]) : null;
            return (
              <Link
                key={slot.key}
                href="/journal"
                className="group flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-all duration-200 hover:bg-surface-elevated/40"
              >
                <span className={`text-lg transition-opacity ${entry ? "opacity-100" : "opacity-25"}`}>
                  {slot.icon}
                </span>
                {entry ? (
                  <span className="text-lg">{MOOD_EMOJIS[entry.moodIndex]}</span>
                ) : (
                  <span className="h-4 w-4 rounded-full border border-white/10" />
                )}
                <span className="text-[9px] font-medium uppercase tracking-wider text-text-tertiary">
                  {slot.label}
                </span>
                {subSlot && (
                  <span className="text-[8px] text-text-tertiary/60">{subSlot.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* 心情统计 */}
        {avgMood !== null && (
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
              <span>今日平均心情</span>
              <span className="text-base">{MOOD_EMOJIS[avgMood]}</span>
              <span className="text-[11px] text-text-tertiary/70">{MOOD_LABELS[avgMood]}</span>
            </div>
            {hasAnyContent && latestEntry && (
              <span className="max-w-[50%] truncate text-right text-[11px] text-text-tertiary/70">
                最新: {latestEntry.content}
              </span>
            )}
          </div>
        )}

        {/* 未记录提示 */}
        {recordedCount === 0 && (
          <div className="mt-3 text-center">
            <p className="text-[12px] text-text-tertiary">点击时间段开始记录你的心情</p>
          </div>
        )}
      </div>

      {/* 照片墙 */}
      {allPhotos.length > 0 && (
        <Link href="/journal" className="block mt-4">
          <div className="rounded-xl border border-white/5 bg-surface/30 p-4 transition-colors hover:bg-surface/50">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                今日照片 · {allPhotos.length}
              </span>
              <span className="text-[10px] text-primary/80">查看全部 →</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {allPhotos.slice(0, 5).map((url, i) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-lg bg-surface/40 ring-1 ring-white/5"
                >
                  <img
                    src={resolveMediaUrl(url)}
                    alt={`daily-photo-${i}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                </div>
              ))}
              {allPhotos.length > 5 && (
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-surface-elevated/60 ring-1 ring-white/5">
                  <span className="text-[13px] font-semibold text-text-primary">
                    +{allPhotos.length - 5}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* 各时段小记卡片 */}
      {entries.length > 0 && (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => {
            const moodMeta = MOODS[entry.moodIndex];
            const mainSlot = TIME_SLOTS.find((s) =>
              s.subSlots.some((ss) => ss.key === entry.timeSlot)
            );
            const subSlot = mainSlot?.subSlots.find((ss) => ss.key === entry.timeSlot);
            return (
              <Link
                key={entry.id}
                href="/journal"
                className="block rounded-xl border border-white/5 bg-surface/20 p-3 transition-all duration-200 hover:bg-surface/40 hover:border-white/10"
              >
                <div className="flex items-start gap-3">
                  {/* 左侧: 时段 + 心情 */}
                  <div className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-lg bg-surface/40 py-2">
                    <span className="text-xs opacity-70">{mainSlot?.icon}</span>
                    <span className="text-lg">{moodMeta?.emoji}</span>
                    <span className="text-[9px] font-medium text-text-tertiary">
                      {subSlot?.label ?? mainSlot?.label ?? entry.timeSlot}
                    </span>
                  </div>

                  {/* 右侧: 内容 + 照片 + 标签 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-text-secondary">
                        {moodMeta?.label}
                      </span>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary/90"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.content && (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-text-primary/90">
                        {entry.content}
                      </p>
                    )}
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {entry.photos.slice(0, 4).map((p, i) => (
                          <div
                            key={`${entry.id}-${i}`}
                            className="relative aspect-square overflow-hidden rounded-md bg-surface/40"
                          >
                            <img
                              src={resolveMediaUrl(p)}
                              alt={`entry-photo-${i}`}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                              }}
                            />
                            {i === 3 && entry.photos!.length > 4 && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <span className="text-[11px] font-semibold text-white">
                                  +{entry.photos!.length - 4}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
