"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Download, X, Calendar as CalendarIcon, Lock } from "lucide-react";
import Link from "next/link";

import { Calendar } from "@/components/journal/calendar";
import { JournalEditor } from "@/components/journal/editor";
import { AIHeard } from "@/components/journal/ai-heard";
import { EmotionMirror } from "@/components/journal/emotion-mirror";
import { MoodWeather } from "@/components/journal/mood-weather";
import { LongTermPatterns } from "@/components/journal/long-term-patterns";
import { EmotionHistory } from "@/components/journal/emotion-history";
import { WordInsight } from "@/components/journal/word-insight";
import { journalApi, TIME_SLOTS, MOODS } from "@/lib/journal";
import { journalCompanionApi } from "@/lib/ai/journal-companion";
import { useI18n } from "@/lib/i18n";
import { easeStandard } from "@/lib/motion";

const MOOD_EMOJIS = MOODS.map((m) => m.emoji);

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function JournalPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayStr());
  const [showExportModal, setShowExportModal] = useState(false);
  const [journalSaved, setJournalSaved] = useState(false);
  const [wordInsight, setWordInsight] = useState<string | null>(null);

  const { data: monthData, isLoading } = useQuery({
    queryKey: ["journal-month", year, month],
    queryFn: () => journalApi.listMonth(year, month),
    staleTime: 60_000,
  });

  const { data: dayData } = useQuery({
    queryKey: ["journal", selectedDate],
    queryFn: () => (selectedDate ? journalApi.getByDate(selectedDate) : Promise.resolve({ data: [] })),
    enabled: !!selectedDate,
    staleTime: 60_000,
  });

  const journals = monthData?.data?.journals ?? [];
  const dayJournals = dayData?.data ?? [];

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setJournalSaved(false);
  };

  const handleSaved = () => {
    setJournalSaved(true);
    queryClient.invalidateQueries({ queryKey: ["journal-companion"] });
  };

  const hasEnoughContent = dayJournals.some(
    (j) => (j.content?.length ?? 0) >= 30
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* 页面标题 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mb-8 flex items-end justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text">
              {t("journal.title")}
            </h1>
            <p className="mt-2 text-[14px] text-text-tertiary">
              {t("journal.subtitle")}
            </p>
          </div>
          <motion.button
            onClick={() => setShowExportModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 rounded-[10px] border border-border-subtle bg-surface px-3 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:border-primary/30 hover:bg-surface-elevated hover:text-text"
          >
            <Download className="h-3.5 w-3.5" />
            导出小记
          </motion.button>
        </motion.div>

        {/* 细分割线 */}
        <div className="mb-8 h-px bg-border-subtle" />

        {/* 网格布局 */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          {/* 左侧: 日历 + 时间线 */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.05, ease: "easeOut" }}
            >
              {isLoading ? (
                <div className="flex h-[420px] items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="font-display text-[14px] font-semibold text-text">
                    今日时间线
                  </h3>
                  <span className="text-[11px] text-text-tertiary">
                    {dayJournals.length} 条记录
                  </span>
                </div>
                <div className="space-y-3">
                  {TIME_SLOTS.map((slot) => {
                    const slotEntries = dayJournals.filter((j) =>
                      slot.subSlots.some((ss) => ss.key === j.timeSlot)
                    );
                    if (slotEntries.length === 0) return null;
                    return (
                      <div key={slot.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-base">{slot.icon}</span>
                          <div className="mt-1 w-px flex-1 bg-border-subtle" />
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-text-secondary">
                              {slot.label}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              {slot.range}
                            </span>
                          </div>
                          <div className="mt-1 space-y-1">
                            {slotEntries.map((entry) => {
                              const subSlot = slot.subSlots.find((ss) => ss.key === entry.timeSlot);
                              return (
                                <div key={entry.id} className="flex items-center gap-2">
                                  <span className="text-[10px] text-text-tertiary">
                                    {subSlot?.label ?? ""}
                                  </span>
                                  <span className="text-sm">
                                    {MOOD_EMOJIS[entry.moodIndex]}
                                  </span>
                                  <p className="flex-1 text-[12px] text-text-secondary line-clamp-1">
                                    {entry.content || entry.tags?.join(" · ") || "无内容"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
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
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="lg:sticky lg:top-6"
          >
            {selectedDate ? (
              <JournalEditor date={selectedDate} onSaved={handleSaved} />
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <div className="mb-4 text-4xl opacity-40">📖</div>
                <p className="text-[14px] text-text-tertiary">
                  {t("journal.selectDateHint")}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* AI 听见 */}
        <AnimatePresence>
          {journalSaved && hasEnoughContent && (
            <AIHeard
              journals={dayJournals}
              date={selectedDate ?? getTodayStr()}
            />
          )}
        </AnimatePresence>

        {/* 情绪镜子 */}
        {selectedDate && dayJournals.length > 0 && (
          <EmotionMirror date={selectedDate} />
        )}

        {/* 心理天气 */}
        <MoodWeather />

        {/* 情绪历史 */}
        <EmotionHistory />

        {/* AI 发现的长期模式 */}
        <LongTermPatterns />

        {/* 关于某个词 */}
        {wordInsight && (
          <WordInsight word={wordInsight} onClose={() => setWordInsight(null)} />
        )}

        {/* 统计信息 */}
        {!isLoading && journals.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-8 text-center">
            <div>
              <p className="font-display text-2xl font-bold text-text">
                {journals.length}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                本月小记
              </p>
            </div>
            <div className="h-10 w-px bg-border-subtle" />
            <div>
              <p className="font-display text-2xl font-bold text-text">
                {new Set(journals.map((j) => j.journalDate)).size}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                记录天数
              </p>
            </div>
          </div>
        )}

        {/* 隐私提示 */}
        <div className="mt-12 flex items-center justify-center gap-1.5 text-[12px] text-text-tertiary">
          <Lock className="h-3 w-3" />
          <span>{t("journal.privacyHint")}</span>
        </div>
      </div>

      {/* 导出弹窗 */}
      <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} />
    </div>
  );
}

// ── 导出弹窗: 按周勾选导出 ──────────────────────────────────────────
function ExportModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = (() => {
    const result: { label: string; start: string; end: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const weekStart = getWeekStart(new Date(now));
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      result.push({
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
        start: formatDateStr(weekStart),
        end: formatDateStr(weekEnd),
      });
    }
    return result;
  })();

  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());

  const toggleWeek = (idx: number) => {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedWeeks.size === 0) {
      setError("请至少选择一周");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const sortedWeeks = Array.from(selectedWeeks).sort((a, b) => a - b);
      const startDate = weeks[sortedWeeks[0]].start;
      const endDate = weeks[sortedWeeks[sortedWeeks.length - 1]].end;
      await journalApi.exportRange(startDate, endDate);
      onClose();
    } catch (err: any) {
      setError(err?.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    setError(null);
    try {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      await journalApi.exportRange(formatDateStr(startOfYear), formatDateStr(now));
      onClose();
    } catch (err: any) {
      setError(err?.message || "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={easeStandard}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[20px] border border-border bg-surface p-6 shadow-soft"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <h3 className="font-display text-[15px] font-semibold text-text">
                  导出小记
                </h3>
              </div>
              <button onClick={onClose} className="text-text-tertiary hover:text-text">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-[12px] text-text-tertiary">
              勾选要导出的周, 导出为 Markdown 文件方便回忆
            </p>

            <div className="max-h-60 space-y-1 overflow-y-auto">
              {weeks.map((week, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleWeek(idx)}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors ${
                    selectedWeeks.has(idx)
                      ? "bg-primary/8 ring-1 ring-primary/20"
                      : "hover:bg-surface-elevated/50"
                  }`}
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                    selectedWeeks.has(idx) ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {selectedWeeks.has(idx) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <CalendarIcon className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-[12px] text-text-secondary">{week.label}</span>
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleExport}
                disabled={exporting || selectedWeeks.size === 0}
                className="flex-1 rounded-[10px] bg-primary py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {exporting ? "导出中..." : `导出选中${selectedWeeks.size > 0 ? ` (${selectedWeeks.size})` : ""}`}
              </button>
              <button
                onClick={handleExportAll}
                disabled={exporting}
                className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-elevated disabled:opacity-50"
              >
                导出今年全部
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
