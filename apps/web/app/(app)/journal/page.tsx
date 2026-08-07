"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, X, Calendar as CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/journal/calendar";
import { JournalEditor } from "@/components/journal/editor";
import { journalApi, TIME_SLOTS, MOODS } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

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
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(getTodayStr());
  const [showExportModal, setShowExportModal] = useState(false);

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
  };

  return (
    <div className="min-h-screen bg-[#09090B]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* 页面标题 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8 flex items-end justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              {t("journal.title")}
            </h1>
            <p className="mt-2 text-[14px] text-text-tertiary">
              {t("journal.subtitle")}
            </p>
          </div>
          {/* 导出按钮 */}
          <motion.button
            onClick={() => setShowExportModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-surface/40 px-3 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-elevated/60"
          >
            <Download className="h-3.5 w-3.5" />
            导出小记
          </motion.button>
        </motion.div>

        {/* 网格布局 */}
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
                  {TIME_SLOTS.map((slot) => {
                    const slotEntries = dayJournals.filter((j) =>
                      slot.subSlots.some((ss) => ss.key === j.timeSlot)
                    );
                    return (
                      <div key={slot.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-lg">{slot.icon}</span>
                          <div className="mt-1 w-px flex-1 bg-white/10" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-text-secondary">
                              {slot.label}
                            </span>
                            <span className="text-[10px] text-text-tertiary">
                              {slot.range}
                            </span>
                            {slotEntries.length > 0 && (
                              <span className="text-[10px] text-success">
                                {slotEntries.length} 条记录
                              </span>
                            )}
                          </div>
                          {slotEntries.length > 0 ? (
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
                                    <p className="text-[12px] text-text-secondary line-clamp-1">
                                      {entry.content || entry.tags?.join(" · ") || "无内容"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
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
          </div>
        )}
      </div>

      {/* 导出弹窗 */}
      <ExportModal
        show={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}

// ── 导出弹窗: 按周勾选导出 ──────────────────────────────────────────
function ExportModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成最近 8 周的列表
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
      // 按选中的周导出 (合并为一个文件)
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <h3 className="font-display text-[15px] font-semibold text-text-primary">
                  导出小记
                </h3>
              </div>
              <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-[12px] text-text-tertiary">
              勾选要导出的周, 导出为 Markdown 文件方便回忆
            </p>

            {/* 周列表 */}
            <div className="max-h-60 space-y-1 overflow-y-auto">
              {weeks.map((week, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleWeek(idx)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedWeeks.has(idx)
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-surface-elevated/50"
                  }`}
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                    selectedWeeks.has(idx) ? "border-primary bg-primary" : "border-white/20"
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
                className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {exporting ? "导出中..." : `导出选中${selectedWeeks.size > 0 ? ` (${selectedWeeks.size})` : ""}`}
              </button>
              <button
                onClick={handleExportAll}
                disabled={exporting}
                className="rounded-lg border border-white/10 bg-surface/40 px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-surface-elevated/60 disabled:opacity-50"
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
