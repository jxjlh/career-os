"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Calendar } from "@/components/journal/calendar";
import { JournalEditor } from "@/components/journal/editor";
import { journalApi } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

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
    staleTime: 1000 * 30, // 30 秒
  });

  const journals = monthData?.data?.journals ?? [];

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* 主容器 */}
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
          {/* 左侧: 日历 */}
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
