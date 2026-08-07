"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Journal } from "@/lib/journal";
import { journalApi, TIME_SLOTS, getSlotMeta } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;
const QUICK_TAGS = ["工作", "学习", "生活", "思考", "休息"];

interface JournalEditorProps {
  date: string; // YYYY-MM-DD
  onSaved?: () => void;
}

/**
 * 每日小记编辑器: 支持一天多个时间段.
 * 顶部时间段切换, 每个时间段可独立记录心情 + 内容 + 标签.
 */
export function JournalEditor({ date, onSaved }: JournalEditorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // 当前选中的时间段
  const [activeSlot, setActiveSlot] = useState<string>("morning");

  // 获取当前日期所有时间段的日记
  const { data: journalData, isLoading } = useQuery<{ data: Journal[] }>({
    queryKey: ["journal", date],
    queryFn: () => journalApi.getByDate(date),
    staleTime: 0,
  });

  const allJournals = journalData?.data ?? [];
  const existing = allJournals.find((j) => j.timeSlot === activeSlot);

  const [moodIndex, setMoodIndex] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // 当 existing 数据变化时同步到本地状态
  useEffect(() => {
    if (existing) {
      setMoodIndex(existing.moodIndex);
      setContent(existing.content ?? "");
      setTags(existing.tags ?? []);
    } else {
      setMoodIndex(null);
      setContent("");
      setTags([]);
    }
  }, [existing?.id, activeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = !!existing;

  const upsertMutation = useMutation({
    mutationFn: () => {
      if (moodIndex === null) throw new Error("请选择心情");
      const payload = {
        mood_index: moodIndex,
        content: content.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        time_slot: activeSlot,
        journal_date: date,
      };
      if (isEditing && existing) {
        return journalApi.update(existing.id, payload);
      }
      return journalApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-month"] });
      onSaved?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!existing) throw new Error("No journal to delete");
      return journalApi.remove(existing.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-month"] });
      setMoodIndex(null);
      setContent("");
      setTags([]);
      onSaved?.();
    },
  });

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (moodIndex === null) return;
    upsertMutation.mutate();
  };

  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T00:00:00");
    const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dateObj.getDay()];
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 · ${weekday}`;
  };

  return (
    <div className="w-full">
      {/* 日期标题 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-text-primary">
            {formatDate(date)}
          </h3>
          <p className="text-[13px] text-text-tertiary">
            {isEditing ? "编辑这个时间段的小记" : "记录这个时间段的感受"}
          </p>
        </div>
        {isEditing && (
          <motion.button
            onClick={() => {
              if (confirm("确定删除这篇小记吗?")) {
                deleteMutation.mutate();
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-8 items-center rounded-lg px-3 text-[12px] text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            删除
          </motion.button>
        )}
      </div>

      {/* 时间段切换 */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        {TIME_SLOTS.map((slot) => {
          const slotJournal = allJournals.find((j) => j.timeSlot === slot.key);
          const isActive = activeSlot === slot.key;
          return (
            <motion.button
              key={slot.key}
              onClick={() => setActiveSlot(slot.key)}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={`
                relative flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-200
                ${isActive
                  ? "bg-primary/15 ring-1 ring-primary/40 shadow-[0_0_16px_rgba(139,92,246,0.2)]"
                  : "bg-surface/40 hover:bg-surface-elevated/60"
                }
              `}
            >
              <span className="text-lg">{slot.icon}</span>
              <span className={`text-[11px] font-medium ${isActive ? "text-primary" : "text-text-tertiary"}`}>
                {slot.label}
              </span>
              {/* 已记录标记 */}
              {slotJournal && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 当前时间段信息 */}
      <div className="mb-4 flex items-center gap-2 text-[11px] text-text-tertiary">
        <span>{getSlotMeta(activeSlot).icon}</span>
        <span>{getSlotMeta(activeSlot).label}</span>
        <span className="text-text-tertiary/60">·</span>
        <span>{getSlotMeta(activeSlot).range}</span>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <>
          {/* 心情选择 */}
          <div className="mb-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {t("journal.moodLabel")}
            </label>
            <div className="flex items-center gap-2">
              {MOOD_EMOJIS.map((m, i) => (
                <motion.button
                  key={m}
                  onClick={() => setMoodIndex(i)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`
                    flex h-12 w-12 items-center justify-center rounded-xl text-xl transition-all duration-200
                    ${moodIndex === i
                      ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_16px_rgba(139,92,246,0.25)]"
                      : "bg-surface/40 hover:bg-surface-elevated/60"
                    }
                  `}
                  aria-label={`mood ${i}`}
                >
                  {m}
                </motion.button>
              ))}
            </div>
          </div>

          {/* 内容输入 */}
          <div className="mb-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {t("journal.contentLabel")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("journal.contentPlaceholder")}
              rows={3}
              className="
                w-full resize-none rounded-xl border border-white/5 bg-surface/30
                px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary/60
                transition-colors duration-200
                focus:border-primary/40 focus:bg-surface/50 focus:outline-none
              "
            />
          </div>

          {/* 快速标签 */}
          <div className="mb-6">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {t("journal.tagsLabel")}
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.map((tag) => (
                <motion.button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`
                    rounded-full px-3 py-1.5 text-[12px] transition-all duration-200
                    ${tags.includes(tag)
                      ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-surface/40 text-text-secondary hover:bg-surface-elevated/60"
                    }
                  `}
                >
                  {tag}
                </motion.button>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <motion.button
            onClick={handleSave}
            disabled={moodIndex === null || upsertMutation.isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`
              flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium transition-all duration-200
              ${moodIndex !== null
                ? "bg-primary text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:bg-primary-hover cursor-pointer"
                : "cursor-not-allowed bg-surface/40 text-text-tertiary"
              }
            `}
          >
            {upsertMutation.isPending
              ? "保存中..."
              : isEditing
                ? "更新小记"
                : "保存小记"}
          </motion.button>

          {/* 保存状态反馈 */}
          {upsertMutation.isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[13px] text-success"
            >
              ✓ 保存成功！
            </motion.div>
          )}
          {upsertMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[13px] text-danger"
            >
              ✗ 保存失败，请重试
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
