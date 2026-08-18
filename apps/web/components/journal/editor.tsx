"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";

import type { Journal } from "@/lib/journal";
import { journalApi } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";

const MOOD_EMOJIS = ["😵", "😐", "🙂", "😎", "✨"] as const;
const QUICK_TAGS = ["工作", "学习", "生活", "思考", "休息"];

interface JournalEditorProps {
  date: string; // YYYY-MM-DD
  onSaved?: () => void;
}

/**
 * 每日小记编辑器: 心情选择 + 内容输入 + 标签.
 * 替代原 MoodPicker 的 localStorage 实现, 改为真正的 CRUD.
 */
export function JournalEditor({ date, onSaved }: JournalEditorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // 获取当前日期的日记
  const { data: journalData, isLoading } = useQuery<{ data: Journal | null }>({
    queryKey: ["journal", date],
    queryFn: () => journalApi.getByDate(date),
    staleTime: 0,
  });

  const existing = journalData?.data;

  const [moodIndex, setMoodIndex] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当 existing 数据加载完成时，同步到本地状态
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
  }, [existing]);

  const isEditing = !!existing;

  const upsertMutation = useMutation({
    mutationFn: () => {
      if (moodIndex === null) throw new Error("请选择今天的心情");
      const payload = {
        mood_index: moodIndex,
        content: content.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        photos: photos.length > 0 ? photos : undefined,
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

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => journalApi.uploadImage(file),
    onSuccess: (url) => {
      setPhotos((prev) => [...prev, url]);
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
      setPhotos([]);
      onSaved?.();
    },
  });

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePickImages = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remaining = 9 - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      uploadImageMutation.mutate(file);
    }
    // 重置 input 以便相同文件可再次选择
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (moodIndex === null) {
      // 显示提示
      return;
    }
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
            {isEditing ? t("journal.editPrompt") : t("journal.writePrompt")}
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
          rows={4}
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

      {/* 照片上传 */}
      <div className="mb-6">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          照片
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <motion.div
              key={url + i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative aspect-square overflow-hidden rounded-lg bg-surface/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removePhoto(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                aria-label="移除照片"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
          {photos.length < 9 && (
            <motion.button
              onClick={handlePickImages}
              disabled={uploadImageMutation.isPending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/10 bg-surface/30 text-text-tertiary transition-colors hover:border-primary/40 hover:bg-surface/50 disabled:opacity-50"
            >
              {uploadImageMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ImagePlus size={18} />
              )}
            </motion.button>
          )}
        </div>
        {uploadImageMutation.isError && (
          <p className="mt-2 text-[12px] text-danger">上传失败，请重试</p>
        )}
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
    </div>
  );
}
