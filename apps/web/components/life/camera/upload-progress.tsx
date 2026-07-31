"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export type UploadState = "idle" | "uploading" | "success" | "error";

interface UploadProgressProps {
  state: UploadState;
  progress?: number; // 0~100
  message?: string;
}

/**
 * 上传进度卡片: idle / uploading (进度条) / success / error.
 * 动画使用 framer-motion, 进度条平滑过渡.
 */
export function UploadProgress({ state, progress = 0, message }: UploadProgressProps) {
  if (state === "idle") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
        {state === "uploading" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {state === "success" && <CheckCircle2 className="h-5 w-5 text-success" />}
        {state === "error" && <UploadCloud className="h-5 w-5 text-danger" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {message ?? (state === "uploading" ? "正在上传…" : state === "success" ? "上传完成" : "上传失败")}
          </span>
          {state === "uploading" && (
            <span className="text-xs text-muted">{Math.round(progress)}%</span>
          )}
        </div>
        {state === "uploading" && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
              transition={{ ease: "easeOut" }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
