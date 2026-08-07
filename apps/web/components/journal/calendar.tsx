"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import type { Journal } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface CalendarProps {
  year: number;
  month: number; // 1-12
  journals: Journal[];
  selectedDate?: string | null; // YYYY-MM-DD
  onDateSelect: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

/**
 * 日历组件: 深色主题, 支持心情标记和日期选择.
 * 设计遵循 CareerOS 设计系统:
 *  - 主背景 #09090B
 *  - 选中日期用 accent glow
 *  - 已记录心情的日期显示 emoji
 */
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

  // 将 journals 转为 Map<date, Journal[]> for O(1) lookup
  const journalMap = useMemo(() => {
    const map = new Map<string, Journal[]>();
    for (const j of journals) {
      const list = map.get(j.journalDate) ?? [];
      list.push(j);
      map.set(j.journalDate, list);
    }
    return map;
  }, [journals]);

  // 计算日历网格
  const grid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay(); // 0-6 (Sun-Sat)
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    } | null> = [];

    // 前置填充
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

    // 当前月
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

    // 后置填充到 6 行 (42 cells)
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
      {/* 头部: 月份导航 */}
      <div className="mb-6 flex items-center justify-between">
        <motion.button
          onClick={prevMonth}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface/40 text-text-secondary transition-colors hover:bg-surface-elevated/60 hover:text-text-primary"
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8L10 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
        <h2 className="font-display text-lg font-semibold text-text-primary">
          {formatMonth(year, month)}
        </h2>
        <motion.button
          onClick={nextMonth}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface/40 text-text-secondary transition-colors hover:bg-surface-elevated/60 hover:text-text-primary"
          aria-label="Next month"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3L11 8L6 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </div>

      {/* 星期标题 */}
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium uppercase tracking-wider text-text-tertiary"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1.5">
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
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`
                relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm
                transition-all duration-200 ease-out
                ${cell.isCurrentMonth ? "text-text-primary" : "text-text-tertiary/40"}
                ${isSelected ? "bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_16px_rgba(139,92,246,0.2)]" : ""}
                ${isToday && !isSelected ? "ring-1 ring-primary/30" : ""}
                ${!isSelected && !isToday ? "hover:bg-surface/50" : ""}
                ${isHovered && !isSelected && "bg-surface/30"}
              `}
            >
              {/* 日期数字 */}
              <span
                className={`text-[13px] ${
                  isToday ? "font-semibold text-primary" : ""
                }`}
              >
                {cell.day}
              </span>

              {/* 心情 emoji + 时间段标记 */}
              {hasMood && latestMood !== null && (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="mt-0.5 text-base leading-none"
                >
                  {MOOD_EMOJIS[latestMood]}
                </motion.span>
              )}

              {/* 时间段小圆点 (最多4个) */}
              {hasMood && (
                <div className="mt-0.5 flex gap-0.5">
                  {dayJournals.slice(0, 4).map((_, i) => (
                    <span
                      key={i}
                      className="h-1 w-1 rounded-full bg-primary/60"
                    />
                  ))}
                </div>
              )}

              {/* 今日标记 */}
              {isToday && !hasMood && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          {t("journal.today")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block text-sm">😊</span>
          {t("journal.hasRecord")}
        </span>
      </div>
    </div>
  );
}
