"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Sparkles, Briefcase, Rocket, Heart, Leaf, MoreHorizontal, CheckCircle2, Circle, Quote, Sun } from "lucide-react";

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  const today = new Date();
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()];

  // ---- 快捷入口配置 ----
  const quickEntries = [
    { icon: Briefcase, label: "求职", color: "bg-blue-100 text-blue-600", href: "/portfolio" },
    { icon: Rocket, label: "技能", color: "bg-purple-100 text-purple-600", href: "/skills" },
    { icon: Leaf, label: "生活方式", color: "bg-green-100 text-green-600", href: "/life" },
    { icon: Heart, label: "健康", color: "bg-pink-100 text-pink-600", href: "/health" },
    { icon: MoreHorizontal, label: "更多", color: "bg-amber-100 text-amber-600", href: "/explore" },
  ];

  // ---- 进度条数据（后续可接入真实 goals 数据）----
  const progressItems = [
    { label: "我的目标", percent: 68, color: "bg-primary" },
    { label: "技能提升", percent: 42, color: "bg-purple-500" },
    { label: "健康管理", percent: 39, color: "bg-green-500" },
  ];

  // ---- 本周计划任务（后续可接入 planner 数据）----
  const weeklyTasks = [
    { id: 1, title: "完成 React 进阶课程", done: true, priority: "高" },
    { id: 2, title: "更新简历项目经历", done: true, priority: "高" },
    { id: 3, title: "投递 5 家目标公司", done: false, priority: "中" },
    { id: 4, title: "阅读《深度工作》第 3 章", done: false, priority: "低" },
    { id: 5, title: "英语口语练习 3 次", done: false, priority: "中" },
  ];

  // ---- 今日动态时间线 ----
  const todayActivities = [
    { time: "09:00", title: "晨间学习", desc: "React Hooks 深度解析", type: "study" },
    { time: "12:30", title: "午间阅读", desc: "《原子习惯》第 5 章", type: "read" },
    { time: "15:00", title: "项目实战", desc: "Dashboard 页面重构", type: "work" },
    { time: "19:00", title: "健身打卡", desc: "有氧 30 分钟", type: "fitness" },
  ];

  const completedTasks = weeklyTasks.filter((t) => t.done).length;

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

      {/* ===== 1. 顶部问候区 ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-text sm:text-[30px]">
            {greeting}，李恒 <Sun className="ml-1 inline h-6 w-6 text-amber-400" />
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            {month}月{date}日 · {weekday} · 今天也要元气满满地前进
          </p>
        </div>
        <div className="hidden rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary sm:block">
          Free Plan
        </div>
      </div>

      {/* ===== 2. 主横幅区 + 天数统计（8 + 4 网格）===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Hero Card - 8 列 */}
        <div className="col-span-12 overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm lg:col-span-8">
          <div className="relative h-56 w-full sm:h-60">
            {/* 风景渐变背景 */}
            <div className="absolute inset-0 bg-gradient-to-br from-sky-400/60 via-blue-500/40 to-indigo-600/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            {/* 装饰光晕 */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-56 rounded-full bg-amber-300/20 blur-2xl" />

            {/* 文字内容 */}
            <div className="absolute bottom-5 left-6 right-6 text-white">
              <p className="font-display text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">
                Better Me Better Future
              </p>
              <p className="mt-1.5 text-[13px] text-white/80 sm:text-[14px]">
                持续成长，每一天都在遇见更好的自己
              </p>
            </div>
          </div>
        </div>

        {/* 天数统计卡 - 4 列 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-white p-5 shadow-sm lg:col-span-4">
          <div className="text-center">
            <p className="font-display text-[44px] font-bold leading-none tracking-tight text-primary">
              07<span className="ml-1 text-[18px] font-semibold text-text-secondary">Days</span>
            </p>
            <p className="mt-1.5 text-[12px] text-text-tertiary">连续打卡天数</p>
          </div>

          <div className="mt-5 space-y-4">
            {progressItems.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">{item.label}</span>
                  <span className="text-[12px] font-semibold text-text">{item.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className={`h-full rounded-full ${item.color} transition-all duration-500`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 3. 快捷入口栏（12 列，flex 横向排列）===== */}
      <div className="rounded-2xl border border-border-subtle bg-white p-5 shadow-sm">
        <div className="flex items-center justify-around gap-2">
          {quickEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link
                key={entry.label}
                href={entry.href}
                className="group flex flex-col items-center gap-2"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${entry.color} transition-transform duration-200 group-hover:scale-110`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-medium text-text-secondary group-hover:text-text">
                  {entry.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ===== 4. 三栏卡片区（4 + 4 + 4）===== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左：本周计划 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-white p-5 shadow-sm lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-text">本周计划</h3>
            <span className="text-[11px] text-text-tertiary">
              {completedTasks}/{weeklyTasks.length} 已完成
            </span>
          </div>

          <div className="space-y-2">
            {weeklyTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-2 transition-colors hover:bg-surface-elevated"
              >
                {task.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary/50" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] ${
                      task.done ? "text-text-tertiary line-through" : "text-text"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-text-tertiary">优先级：{task.priority}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/planner"
            className="mt-4 block text-center text-[12px] text-primary transition-colors hover:text-primary-glow"
          >
            查看全部计划 →
          </Link>
        </div>

        {/* 中：今日动态 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-white p-5 shadow-sm lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-text">今日动态</h3>
            <span className="text-[11px] text-text-tertiary">{todayActivities.length} 项活动</span>
          </div>

          <div className="relative space-y-4 pl-4">
            {/* 时间线 */}
            <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border-subtle" />

            {todayActivities.map((activity, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-medium text-text-tertiary">
                      {activity.time}
                    </span>
                    <span className="text-[13px] font-medium text-text">{activity.title}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-secondary">{activity.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/journal"
            className="mt-4 block text-center text-[12px] text-primary transition-colors hover:text-primary-glow"
          >
            记录今天 →
          </Link>
        </div>

        {/* 右：AI 语录 */}
        <div className="col-span-12 rounded-2xl border border-border-subtle bg-white p-5 shadow-sm lg:col-span-4">
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
            <button className="flex items-center gap-1 text-primary transition-colors hover:text-primary-glow">
              <Sparkles className="h-3 w-3" />
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
      {/* <DailyJournal /> */}

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
