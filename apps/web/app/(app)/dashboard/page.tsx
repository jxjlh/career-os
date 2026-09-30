"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Sparkles, Heart, CheckCircle2, Circle, Quote, Loader2, CalendarDays, Footprints, Moon, Activity, Flame } from "lucide-react";

import { MottoBanner } from "@/components/motto-banner";
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
import { healthApi, formatNumber, formatSleep, type HealthDay } from "@/lib/health";

type Envelope = { data: any };

const PRIORITY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const onboarding = useQuery<Envelope>({
    queryKey: ["onboarding-status"],
    queryFn: () => apiFetch("/onboarding/status"),
  });
  const advice = useQuery<Envelope>({
    queryKey: ["dashboard-advice"],
    queryFn: () => apiFetch("/dashboard/ai-advice"),
  });

  // ---- 本周计划：真实读取 planner 生成的周计划 ----
  const plan = useQuery<Envelope>({
    queryKey: ["planner-current"],
    queryFn: () => apiFetch("/planner/current"),
    staleTime: 30_000,
  });
  const toggleTask = useMutation({
    mutationFn: (taskId: string) => apiFetch(`/planner/tasks/${taskId}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  const planData = plan.data?.data;
  const weeklyTasks = useMemo(() => {
    const list: any[] = [...(planData?.tasks || [])];
    list.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return list;
  }, [planData]);

  // ---- 快捷入口已移除：卡片只保留「今日健康」数据条 ----

  const completedTasks = weeklyTasks.filter((t: any) => t.status === "done").length;

  return (
    <div className="space-y-6 pb-8">
      {/* ===== 顶部引导横幅（保留原有逻辑）===== */}
      {onboarding.data?.data && !onboarding.data.data.completed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-primary/20 bg-primary/5 px-4 py-3">
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

      {/* ===== 1. 座右铭 Banner ===== */}
      <MottoBanner />

      {/* ===== 2. 今日健康卡片 ===== */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
        <TodayHealthStrip />
      </div>

      {/* ===== 4. 三栏卡片区（4 + 4 + 4）===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左：本周计划 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm lg:col-span-6">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-text">本周计划</h3>
            <span className="text-[11px] text-text-tertiary">
              {completedTasks}/{weeklyTasks.length} 已完成
            </span>
          </div>
          {planData?.weekStart && (
            <p className="mb-3 flex items-center gap-1 text-[11px] text-text-tertiary">
              <CalendarDays className="h-3 w-3" />
              {planData.weekStart} 起{planData.aiGenerated ? " · AI 生成" : ""}
            </p>
          )}
          {planData?.weeklyFocus && (
            <p className="mb-3 rounded-xl bg-primary/5 px-3 py-2 text-[12px] leading-relaxed text-text-secondary">
              {planData.weeklyFocus}
            </p>
          )}

          {plan.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-[12px] text-text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载本周计划…
            </div>
          ) : weeklyTasks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[12px] text-text-tertiary">本周还没有计划</p>
              <Link
                href="/planner"
                className="mt-2 inline-block text-[12px] text-primary hover:text-primary-glow"
              >
                让 AI 生成本周计划 →
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {weeklyTasks.slice(0, 6).map((task: any) => {
                const done = task.status === "done";
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTask.mutate(task.id)}
                    disabled={toggleTask.isPending}
                    className="flex w-full items-start gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:bg-surface-elevated disabled:opacity-60"
                  >
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary/50" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] ${done ? "text-text-tertiary line-through" : "text-text"}`}>
                        {task.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-text-tertiary">
                        {DAY_LABELS[(task.day ?? 1) - 1] ?? ""}
                        {task.estimatedMinutes ? ` · ${task.estimatedMinutes} 分钟` : ""}
                        {task.priority ? ` · 优先级：${PRIORITY_LABELS[task.priority] ?? task.priority}` : ""}
                        {task.goalName ? ` · #${task.goalName}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <Link
            href="/planner"
            className="mt-4 block text-center text-[12px] text-primary transition-colors hover:text-primary-glow"
          >
            查看全部计划 →
          </Link>
        </div>

        {/* 右：AI 语录 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm lg:col-span-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-display text-[15px] font-semibold text-text">AI 语录</h3>
          </div>

          <div className="relative rounded-xl bg-primary/5 p-4">
            <Quote className="absolute -top-2 -left-1 h-6 w-6 text-primary/20" />
            <p className="relative text-[13px] leading-relaxed text-text-secondary">
              {advice.data?.data?.advice ||
                "成长不是一蹴而就的瞬间，而是日复一日的坚持。每一个微小的进步，都是在为更好的自己铺路。"}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between text-[11px] text-text-tertiary">
            <span>每日 AI 寄语</span>
            <button
              onClick={() => advice.refetch()}
              disabled={advice.isFetching}
              className="flex items-center gap-1 text-primary transition-colors hover:text-primary-glow disabled:opacity-60"
            >
              {advice.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              换一句
            </button>
          </div>
        </div>
      </div>

      {/* ===== 以下为原有组件，暂时注释保留 ===== */}
      {/* <Hero /> */}
      {/* <StreakCard /> */}
      {/* <ActiveGoals /> */}
      {/* <WeeklyPlanProgress /> */}
      {/* <LifeMapPreview /> */}

      {/* ===== 5. 每日小记 ===== */}
      <DailyJournal />

      {advice.data?.data?.advice && (
        <section className="hidden border-t border-border-subtle pt-6">
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

const SOURCE_LABELS: Record<string, string> = {
  apple_watch: "Apple Watch",
  iphone: "iPhone",
  android: "安卓",
  manual: "手动",
};

/** 今日健康数据条：放在快捷入口上方，展示步数 / 睡眠 / 静息心率 / 活动能量 */
function TodayHealthStrip() {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["health-today", todayStr],
    queryFn: () => healthApi.daily(todayStr, todayStr),
    staleTime: 5 * 60_000,
  });

  const day: HealthDay | undefined = data?.data?.days?.[0];
  const hasData = day != null && [day.steps, day.sleepMinutes, day.restingHr, day.activeEnergyKcal].some((v) => v != null);

  const items = [
    { icon: Footprints, label: "步数", value: day ? formatNumber(day.steps) : "--", color: "text-blue-600 bg-blue-100" },
    { icon: Moon, label: "睡眠", value: day ? formatSleep(day.sleepMinutes) : "--", color: "text-indigo-600 bg-indigo-100" },
    { icon: Activity, label: "静息心率", value: day ? (day.restingHr != null ? `${day.restingHr} 次/分` : "--") : "--", color: "text-rose-600 bg-rose-100" },
    { icon: Flame, label: "活动能量", value: day ? formatNumber(day.activeEnergyKcal != null ? Math.round(day.activeEnergyKcal) : null, " 千卡") : "--", color: "text-orange-600 bg-orange-100" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 pb-1 text-[12px] text-text-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载今日健康数据…
      </div>
    );
  }

  if (!hasData) {
    return (
      <Link href="/health-tracker" className="flex items-center justify-between rounded-xl bg-surface-elevated px-4 py-3 transition-colors hover:bg-primary/5">
        <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
          <Heart className="h-4 w-4 text-rose-500/70" />
          还没有今日健康数据，连接手机后自动同步到这里
        </div>
        <span className="text-[12px] text-primary">去设置 →</span>
      </Link>
    );
  }

  return (
    <Link href="/health-tracker" className="block">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          今日健康
        </span>
        <span className="text-[10px] text-text-tertiary/70">
          {day?.source ? `来源：${SOURCE_LABELS[day.source] ?? day.source}` : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-3 rounded-xl bg-surface-elevated px-3 py-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.color}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold leading-tight text-text">{item.value}</p>
                <p className="mt-0.5 text-[10px] text-text-tertiary">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
