"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Journal } from "@/lib/journal";
import { journalApi, TIME_SLOTS, MOODS, getSlotMeta, getSubSlotMeta } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

const QUICK_TAGS = ["工作", "学习", "生活", "思考", "休息"];

interface JournalEditorProps {
  date: string;
  onSaved?: () => void;
}

/**
 * 每日小记编辑器:
 * - 4 个主时段 (上午/下午/晚上/深夜), 点击展开显示 2 小时子时段
 * - 心情 emoji 下方有描述文字
 * - 每个子时段可独立记录
 */
export function JournalEditor({ date, onSaved }: JournalEditorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [activeSlot, setActiveSlot] = useState<string>("morning_06");
  const [expandedMain, setExpandedMain] = useState<string | null>(null);

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
    mutationFn: async () => {
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

  const activeSubSlot = getSubSlotMeta(activeSlot);
  const activeMain = getSlotMeta(activeSlot);

  return (
    <div className="w-full">
      {/* 日期标题 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold text-text-primary">
            {formatDate(date)}
          </h3>
          <p className="text-[13px] text-text-tertiary">
            {isEditing ? "编辑这个小记" : "记录这个时间段的感受"}
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

      {/* 主时段切换 + 可展开子时段 */}
      <div className="mb-5 space-y-2">
        {TIME_SLOTS.map((slot) => {
          const isActive = activeMain.key === slot.key;
          const isExpanded = expandedMain === slot.key;
          const slotJournals = allJournals.filter((j) =>
            slot.subSlots.some((ss) => ss.key === j.timeSlot)
          );

          return (
            <div key={slot.key}>
              {/* 主时段按钮 */}
              <motion.button
                onClick={() => {
                  setExpandedMain(isExpanded ? null : slot.key);
                  // 切到该时段的第一个子时段
                  if (!isExpanded) {
                    setActiveSlot(slot.subSlots[0]?.key ?? slot.key);
                  }
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={`
                  relative flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200
                  ${isActive
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "bg-surface/40 hover:bg-surface-elevated/60"
                  }
                `}
              >
                <span className="text-lg">{slot.icon}</span>
                <div className="flex-1 text-left">
                  <span className={`text-[13px] font-medium ${isActive ? "text-primary" : "text-text-secondary"}`}>
                    {slot.label}
                  </span>
                  <span className="ml-2 text-[10px] text-text-tertiary">
                    {slot.range}
                  </span>
                </div>
                {/* 已记录数量 */}
                {slotJournals.length > 0 && (
                  <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-medium text-success">
                    {slotJournals.length}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-text-tertiary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </motion.button>

              {/* 子时段 (展开时显示) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 flex flex-wrap gap-1.5 pl-4">
                      {slot.subSlots.map((ss) => {
                        const ssJournal = allJournals.find((j) => j.timeSlot === ss.key);
                        const isSsActive = activeSlot === ss.key;
                        return (
                          <button
                            key={ss.key}
                            onClick={() => setActiveSlot(ss.key)}
                            className={`
                              flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150
                              ${isSsActive
                                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                : "bg-surface/30 text-text-tertiary hover:bg-surface-elevated/50"
                              }
                            `}
                          >
                            <span>{ss.label}</span>
                            {ssJournal && (
                              <span className="text-[10px]">
                                {MOODS[ssJournal.moodIndex]?.emoji}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* 当前子时段信息 */}
      {activeSubSlot && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-text-tertiary">
          <span>{activeMain.icon}</span>
          <span>{activeMain.label}</span>
          <span className="text-text-tertiary/60">·</span>
          <span>{activeSubSlot.label}</span>
          <span className="text-text-tertiary/60">时段</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <>
          {/* 心情选择 (带描述) */}
          <div className="mb-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {t("journal.moodLabel")}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((mood, i) => (
                <motion.button
                  key={mood.emoji}
                  onClick={() => setMoodIndex(i)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`
                    flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-200
                    ${moodIndex === i
                      ? "bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                      : "bg-surface/40 hover:bg-surface-elevated/60"
                    }
                  `}
                  aria-label={`mood ${i}`}
                >
                  <span className="text-xl">{mood.emoji}</span>
                  <span className={`text-[10px] font-medium ${moodIndex === i ? "text-primary" : "text-text-tertiary"}`}>
                    {mood.label}
                  </span>
                  <span className="text-[9px] text-text-tertiary/70">{mood.desc}</span>
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
