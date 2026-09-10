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

      <Hero />

      <StreakCard />

      <ActiveGoals />

      <WeeklyPlanProgress />

      <LifeMapPreview />

      <DailyJournal />

      {advice.data?.data?.advice && (
        <section className="mt-12 border-t border-border-subtle pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
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

  const getSlotEntry = (slotKey: string) => {
    const slot = TIME_SLOTS.find((s) => s.key === slotKey);
    if (!slot) return null;
    const slotEntries = entries.filter((e) =>
      slot.subSlots.some((ss) => ss.key === e.timeSlot)
    );
    return slotEntries.length > 0 ? slotEntries[slotEntries.length - 1] : null;
  };

  const hasAnyContent = entries.some((e) => e.content && e.content.trim().length > 0);
  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;

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

      <div className="mt-3 rounded-[14px] border border-border-subtle bg-surface p-4">
        <div className="flex items-center gap-2">
          {TIME_SLOTS.map((slot) => {
            const entry = getSlotEntry(slot.key);
            const subSlot = entry ? (slot.subSlots.find((ss) => ss.key === entry.timeSlot) ?? slot.subSlots[0]) : null;
            return (
              <Link
                key={slot.key}
                href="/journal"
                className="group flex flex-1 flex-col items-center gap-1 rounded-[10px] py-2 transition-all duration-200 hover:bg-surface-elevated"
              >
                <span className={`text-lg transition-opacity ${entry ? "opacity-100" : "opacity-25"}`}>
                  {slot.icon}
                </span>
                {entry ? (
                  <span className="text-lg">{MOOD_EMOJIS[entry.moodIndex]}</span>
                ) : (
                  <span className="h-4 w-4 rounded-full border border-border" />
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

        {avgMood !== null && (
          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
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

        {recordedCount === 0 && (
          <div className="mt-3 text-center">
            <p className="text-[12px] text-text-tertiary">点击时间段开始记录你的心情</p>
          </div>
        )}
      </div>

      {allPhotos.length > 0 && (
        <Link href="/journal" className="block mt-4">
          <div className="rounded-[14px] border border-border-subtle bg-surface p-4 transition-colors hover:bg-surface-elevated">
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
                  className="relative aspect-square overflow-hidden rounded-[10px] bg-surface-elevated ring-1 ring-border-subtle"
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
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] bg-surface-elevated ring-1 ring-border-subtle">
                  <span className="text-[13px] font-semibold text-text-secondary">
                    +{allPhotos.length - 5}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Link>
      )}

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
                className="block rounded-[12px] border border-border-subtle bg-surface p-3 transition-all duration-200 hover:bg-surface-elevated hover:border-border"
              >
                <div className="flex items-start gap-3">
                  <div className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-[10px] bg-surface-elevated py-2">
                    <span className="text-xs opacity-70">{mainSlot?.icon}</span>
                    <span className="text-lg">{moodMeta?.emoji}</span>
                    <span className="text-[9px] font-medium text-text-tertiary">
                      {subSlot?.label ?? mainSlot?.label ?? entry.timeSlot}
                    </span>
                  </div>

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
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.content && (
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-text-secondary">
                        {entry.content}
                      </p>
                    )}
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {entry.photos.slice(0, 4).map((p, i) => (
                          <div
                            key={`${entry.id}-${i}`}
                            className="relative aspect-square overflow-hidden rounded-[8px] bg-surface-elevated"
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
