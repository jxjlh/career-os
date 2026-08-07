"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Calendar } from "@/components/journal/calendar";
import { JournalEditor } from "@/components/journal/editor";
import { journalApi, TIME_SLOTS } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function JournalPage() {
  const { t } = useI18n();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayStr());

  // 获取当月所有日记
  const { data: monthData, isLoading } = useQuery({
    queryKey: ["journal-month", year, month],
    queryFn: () => journalApi.listMonth(year, month),
    staleTime: 1000 * 30,
  });

  // 获取选中日期的日记列表 (用于时间线展示)
  const { data: dayData } = useQuery({
    queryKey: ["journal", selectedDate],
    queryFn: () => (selectedDate ? journalApi.getByDate(selectedDate) : Promise.resolve({ data: [] })),
    enabled: !!selectedDate,
  });

  const journals = monthData?.data?.journals ?? [];
  const dayJournals = dayData?.data ?? [];

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  return (
    <div className="min-h-screen bg-[#09090B]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* 页面标题 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8"
        >
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            {t("journal.title")}
          </h1>
          <p className="mt-2 text-[14px] text-text-tertiary">
            {t("journal.subtitle")}
          </p>
        </motion.div>

        {/* 网格布局: 左日历 + 右编辑器 */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* 左侧: 日历 + 时间线 */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              className="rounded-2xl border border-white/5 bg-surface/30 p-6"
            >
              {isLoading ? (
                <div className="flex h-[420px] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              ) : (
                <Calendar
                  year={year}
                  month={month}
                  journals={journals}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onMonthChange={handleMonthChange}
                />
              )}
            </motion.div>

            {/* 时间段时间线 */}
            {selectedDate && dayJournals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                className="rounded-2xl border border-white/5 bg-surface/30 p-6"
              >
                <h3 className="mb-4 font-display text-[15px] font-semibold text-text-primary">
                  今日时间线
                </h3>
                <div className="space-y-3">
                  {/* 全天时间段(含未记录的) */}
                  {TIME_SLOTS.map((slot) => {
                    const entry = dayJournals.find((j) => j.timeSlot === slot.key);
                    return (
                      <div key={slot.key} className="flex gap-3">
                        {/* 时间轴 */}
                        <div className="flex flex-col items-center">
                          <span className="text-lg">{slot.icon}</span>
                          <div className="mt-1 w-px flex-1 bg-white/10" />
                        </div>
                        {/* 内容 */}
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-text-secondary">
                              {slot.label}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              {slot.range}
                            </span>
                            {entry && (
                              <span className="text-sm">
                                {MOOD_EMOJIS[entry.moodIndex]}
                              </span>
                            )}
                          </div>
                          {entry ? (
                            <p className="mt-1 text-[13px] text-text-secondary line-clamp-2">
                              {entry.content || `${entry.tags?.join(" · ") || "无内容"}`}
                            </p>
                          ) : (
                            <p className="mt-1 text-[12px] text-text-tertiary/50">
                              未记录
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* 右侧: 编辑器 */}
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-2xl border border-white/5 bg-surface/30 p-6 lg:sticky lg:top-6"
          >
            {selectedDate ? (
              <JournalEditor date={selectedDate} />
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <div className="mb-4 text-5xl">📖</div>
                <p className="text-[14px] text-text-tertiary">
                  {t("journal.selectDateHint")}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* 空状态 */}
        {!isLoading && journals.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center"
          >
            <div className="mb-3 text-4xl">🌱</div>
            <h3 className="mb-2 text-[15px] font-medium text-text-primary">
              {t("journal.emptyTitle")}
            </h3>
            <p className="text-[13px] text-text-tertiary">
              {t("journal.emptyDesc")}
            </p>
          </motion.div>
        )}

        {/* 统计信息 */}
        {!isLoading && journals.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-8 text-center">
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">
                {journals.length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                本月小记
              </p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">
                {new Set(journals.map((j) => j.journalDate)).size}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                记录天数
              </p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="font-display text-2xl font-bold text-text-primary">
                {journals.filter((j) => j.content).length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                有内容
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
