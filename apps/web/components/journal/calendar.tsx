"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import type { Journal } from "@/lib/journal";
import { MOODS } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";
import { easeFast } from "@/lib/motion";

const MOOD_EMOJIS = MOODS.map((m) => m.emoji);
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface CalendarProps {
  year: number;
  month: number;
  journals: Journal[];
  selectedDate?: string | null;
  onDateSelect: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function Calendar({
  year,
  month,
  journals,
  selectedDate,
  onDateSelect,
  onMonthChange,
}: CalendarProps) {
  const { t } = useI18n();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const journalMap = useMemo(() => {
    const map = new Map<string, Journal[]>();
    for (const j of journals) {
      const list = map.get(j.journalDate) ?? [];
      list.push(j);
      map.set(j.journalDate, list);
    }
    return map;
  }, [journals]);

  const grid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    } | null> = [];

    const prevMonthDays = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      cells.push({
        date: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
        isToday: false,
      });
    }

    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        isToday:
          today.getFullYear() === year &&
          today.getMonth() + 1 === month &&
          today.getDate() === d,
      });
    }

    const totalCells = Math.max(42, cells.length);
    let nextDay = 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    while (cells.length < totalCells) {
      cells.push({
        date: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
        day: nextDay,
        isCurrentMonth: false,
        isToday: false,
      });
      nextDay++;
    }

    return cells;
  }, [year, month]);

  const prevMonth = () => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    onMonthChange?.(newYear, newMonth);
  };

  const nextMonth = () => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    onMonthChange?.(newYear, newMonth);
  };

  const formatMonth = (y: number, m: number) =>
    `${y}年${m}月`;

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  return (
    <div className="w-full">
      {/* 月份导航 */}
      <div className="mb-5 flex items-center justify-between">
        <motion.button
          onClick={prevMonth}
          whileTap={{ scale: 0.92 }}
          transition={easeFast}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
        <h2 className="font-display text-[15px] font-semibold text-text">
          {formatMonth(year, month)}
        </h2>
        <motion.button
          onClick={nextMonth}
          whileTap={{ scale: 0.92 }}
          transition={easeFast}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>
      </div>

      {/* 星期标题 */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-medium text-text-tertiary"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, idx) => {
          if (!cell) return <div key={idx} />;

          const dayJournals = journalMap.get(cell.date) ?? [];
          const isSelected = selectedDate === cell.date;
          const isHovered = hoveredDate === cell.date;
          const isToday = cell.isToday;
          const hasMood = dayJournals.length > 0;
          const latestMood = dayJournals.length > 0
            ? dayJournals[dayJournals.length - 1].moodIndex
            : null;

          return (
            <motion.button
              key={idx}
              onClick={() => onDateSelect(cell.date)}
              onMouseEnter={() => setHoveredDate(cell.date)}
              onMouseLeave={() => setHoveredDate(null)}
              whileTap={{ scale: 0.92 }}
              transition={easeFast}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-[10px] text-sm transition-all duration-200
                ${cell.isCurrentMonth ? "text-text" : "text-text-tertiary/30"}
                ${isSelected ? "bg-primary/8" : ""}
                ${isToday && !isSelected ? "ring-1 ring-primary/20" : ""}
                ${!isSelected && !isToday && isHovered ? "bg-surface-elevated/50" : ""}
              `}
            >
              <span className={`text-[12px] ${isToday ? "font-semibold text-primary" : ""}`}>
                {cell.day}
              </span>

              {hasMood && latestMood !== null && (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mt-0.5 text-[13px] leading-none"
                >
                  {MOOD_EMOJIS[latestMood]}
                </motion.span>
              )}

              {hasMood && (
                <div className="mt-0.5 flex gap-0.5">
                  {dayJournals.slice(0, 4).map((_, i) => (
                    <span
                      key={i}
                      className="h-0.5 w-0.5 rounded-full bg-primary/40"
                    />
                  ))}
                </div>
              )}

              {isToday && !hasMood && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          {t("journal.today")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block text-[12px]">😊</span>
          {t("journal.hasRecord")}
        </span>
      </div>
    </div>
  );
}
