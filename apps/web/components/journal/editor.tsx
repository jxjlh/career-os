"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ImagePlus, X, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { resolveMediaUrl } from "@/lib/chat";
import { extractPastedImages } from "@/lib/pasted-image.mjs";
import type { Journal } from "@/lib/journal";
import { journalApi, TIME_SLOTS, MOODS, getSlotMeta, getSubSlotMeta } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";
import { easeFast, easeStandard } from "@/lib/motion";

const QUICK_TAGS = ["工作", "学习", "生活", "思考", "休息"];
const MAX_IMAGES = 9;

const PLACEHOLDERS = [
  "想说什么都可以。",
  "今天发生了什么？",
  "把脑子里的东西先放在这里。",
  "不需要写得很好。",
  "想说什么，就说什么。",
];

function getRandomPlaceholder() {
  return PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];
}

interface JournalEditorProps {
  date: string;
  onSaved?: () => void;
}

export function JournalEditor({ date, onSaved }: JournalEditorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeSlot, setActiveSlot] = useState<string>("morning_06");
  const [expandedMain, setExpandedMain] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(getRandomPlaceholder());

  const { data: journalData, isLoading } = useQuery<{ data: Journal[] }>({
    queryKey: ["journal", date],
    queryFn: () => journalApi.getByDate(date),
    staleTime: 60_000,
  });

  const allJournals = journalData?.data ?? [];
  const existing = allJournals.find((j) => j.timeSlot === activeSlot);

  const [moodIndex, setMoodIndex] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewUrl]);

  useEffect(() => {
    if (existing) {
      setMoodIndex(existing.moodIndex);
      setContent(existing.content ?? "");
      setTags(existing.tags ?? []);
      setPhotos(existing.photos ?? []);
    } else {
      setMoodIndex(null);
      setContent("");
      setTags([]);
      setPhotos([]);
    }
    setPlaceholder(getRandomPlaceholder());
  }, [existing?.id, activeSlot]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEditing = !!existing;

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => journalApi.uploadImage(file),
    onSuccess: (url) => {
      setPhotos((prev) => [...prev, url]);
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (moodIndex === null) throw new Error("请选择心情");
      const payload = {
        mood_index: moodIndex,
        content: content.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        photos: photos.length > 0 ? photos : undefined,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved?.();
    },
    onError: (error: any) => {
      console.error("保存失败:", error);
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setMoodIndex(null);
      setContent("");
      setTags([]);
      setPhotos([]);
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

  const handlePickImages = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - photos.length;
    if (remaining <= 0) return;
    const list = Array.from(files).slice(0, remaining);
    // eslint-disable-next-line no-restricted-syntax
    for (const f of list) {
      // eslint-disable-next-line no-await-in-loop
      await uploadImageMutation.mutateAsync(f);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLElement>) => {
    const images = extractPastedImages(event.clipboardData.items, event.clipboardData.files);
    if (images.length === 0) return;
    event.preventDefault();
    const remaining = MAX_IMAGES - photos.length;
    for (const file of images.slice(0, Math.max(remaining, 0))) {
      await uploadImageMutation.mutateAsync(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const formatDate = (d: string) => {
    const dateObj = new Date(d + "T00:00:00");
    const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dateObj.getDay()];
    return `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 · ${weekday}`;
  };

  const activeSubSlot = getSubSlotMeta(activeSlot);
  const activeMain = getSlotMeta(activeSlot);

  return (
    <div className="w-full" onPasteCapture={(e) => void handlePaste(e)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 日期标题 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-display text-[16px] font-semibold text-text">
            {formatDate(date)}
          </h3>
          <p className="mt-0.5 text-[12px] text-text-tertiary">
            {isEditing ? t("journal.editPrompt") : "想说什么，就说什么"}
          </p>
        </div>
        {isEditing && (
          <button
            onClick={() => {
              if (confirm("确定删除这篇小记吗?")) {
                deleteMutation.mutate();
              }
            }}
            className="flex h-8 items-center rounded-[8px] px-3 text-[12px] text-text-tertiary transition-colors hover:bg-danger/8 hover:text-danger"
          >
            删除
          </button>
        )}
      </div>

      {/* 主时段切换 */}
      <div className="mb-5 space-y-1.5">
        {TIME_SLOTS.map((slot) => {
          const isActive = activeMain.key === slot.key;
          const isExpanded = expandedMain === slot.key;
          const slotJournals = allJournals.filter((j) =>
            slot.subSlots.some((ss) => ss.key === j.timeSlot)
          );

          return (
            <div key={slot.key}>
              <button
                onClick={() => {
                  setExpandedMain(isExpanded ? null : slot.key);
                  if (!isExpanded) {
                    setActiveSlot(slot.subSlots[0]?.key ?? slot.key);
                  }
                }}
                className={`relative flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 transition-all duration-200
                  ${isActive
                    ? "bg-primary/6"
                    : "hover:bg-surface-elevated/50"
                  }
                `}
              >
                <span className="text-[15px]">{slot.icon}</span>
                <div className="flex-1 text-left">
                  <span className={`text-[13px] font-medium ${isActive ? "text-text" : "text-text-secondary"}`}>
                    {slot.label}
                  </span>
                  <span className="ml-2 text-[10px] text-text-tertiary">
                    {slot.range}
                  </span>
                </div>
                {slotJournals.length > 0 && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                    {slotJournals.length}
                  </span>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 flex flex-wrap gap-1.5 pl-3">
                      {slot.subSlots.map((ss) => {
                        const ssJournal = allJournals.find((j) => j.timeSlot === ss.key);
                        const isSsActive = activeSlot === ss.key;
                        return (
                          <button
                            key={ss.key}
                            onClick={() => setActiveSlot(ss.key)}
                            className={`flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150
                              ${isSsActive
                                ? "bg-primary/8 text-primary"
                                : "bg-surface text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary"
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

      {/* 细分割线 */}
      <div className="h-px bg-border-subtle mb-5" />

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      ) : (
        <>
          {/* 心情选择 —— 轻量、克制 */}
          <div className="mb-5">
            <p className="mb-3 text-[11px] text-text-tertiary">
              {t("journal.moodLabel")}
            </p>
            <div className="flex items-center justify-between">
              {MOODS.map((mood, i) => (
                <motion.button
                  key={mood.emoji}
                  onClick={() => setMoodIndex(i)}
                  whileTap={{ scale: 0.9 }}
                  transition={easeFast}
                  className={`flex flex-col items-center gap-0.5 rounded-[12px] px-3 py-2 transition-all duration-200
                    ${moodIndex === i
                      ? "bg-surface-elevated"
                      : "hover:bg-surface-elevated/50"
                    }
                  `}
                  aria-label={`mood ${i}`}
                >
                  <motion.span
                    animate={{ scale: moodIndex === i ? 1.15 : 1 }}
                    transition={easeStandard}
                    className="text-[20px]"
                  >
                    {mood.emoji}
                  </motion.span>
                  <span className={`text-[10px] ${moodIndex === i ? "text-text" : "text-text-tertiary"}`}>
                    {mood.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* 文字输入 —— 核心区域 */}
          <div className="mb-5">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="w-full resize-none rounded-[14px] border border-border-subtle bg-surface px-4 py-3 text-[14px] leading-relaxed text-text placeholder:text-text-tertiary/60 transition-all duration-200 focus:border-primary/30 focus:outline-none focus:bg-surface"
            />
          </div>

          {/* 照片 + 标签行 */}
          <div className="mb-5 flex items-center gap-4">
            <button
              type="button"
              onClick={handlePickImages}
              disabled={uploadImageMutation.isPending || photos.length >= MAX_IMAGES}
              className="flex items-center gap-1.5 text-[12px] text-text-tertiary transition-colors hover:text-text-secondary disabled:opacity-50"
            >
              {uploadImageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              <span>{uploadImageMutation.isPending ? "上传中" : "添加照片"}</span>
            </button>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-all duration-200
                    ${tags.includes(tag)
                      ? "bg-primary/8 text-primary"
                      : "bg-surface-elevated/50 text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary"
                    }
                  `}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* 照片预览网格 */}
          {photos.length > 0 && (
            <div className="mb-5 grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-[10px] bg-surface-elevated"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(resolveMediaUrl(url))}
                    className="h-full w-full"
                    aria-label={`放大查看第 ${i + 1} 张图片`}
                  >
                    <img
                      src={resolveMediaUrl(url)}
                      alt={`photo-${i}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                    aria-label="删除图片"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadImageMutation.isError && (
            <p className="mb-3 text-[11px] text-danger">
              图片上传失败：{uploadImageMutation.error?.message || "请稍后重试"}
            </p>
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={moodIndex === null || upsertMutation.isPending || uploadImageMutation.isPending}
            className={`flex w-full items-center justify-center rounded-[12px] py-3 text-[14px] font-medium transition-all duration-200
              ${moodIndex !== null && !uploadImageMutation.isPending
                ? "bg-primary text-white hover:bg-primary-hover"
                : "cursor-not-allowed bg-surface-elevated text-text-tertiary"
              }
            `}
          >
            {upsertMutation.isPending
              ? "保存中..."
              : isEditing
                ? t("journal.updateButton")
                : t("journal.saveButton")}
          </button>

          {/* 保存反馈 */}
          {upsertMutation.isSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[13px] text-success"
            >
              ✓ {t("journal.savedHint")}
            </motion.p>
          )}
          {upsertMutation.isError && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-[13px] text-danger"
            >
              ✗ {upsertMutation.error?.message || "保存失败，请重试"}
            </motion.p>
          )}
        </>
      )}

      {/* 图片预览弹窗 */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="日记图片预览"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewUrl(null)}
          >
            <motion.img
              src={previewUrl}
              alt="日记图片预览"
              className="max-h-full max-w-full rounded-[14px] object-contain shadow-soft"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              onClick={(event) => event.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute right-5 top-5 rounded-[10px] bg-black/40 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/60"
            >
              关闭
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
