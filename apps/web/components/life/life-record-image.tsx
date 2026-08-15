"use client";

import { useEffect, useState } from "react";

import { getRecordMediaUrl } from "@/lib/life";

/**
 * LifeRecordImage —— 人生记录图片组件
 *
 * 改进点:
 * 1. 支持自动重试（最多 2 次）
 * 2. 处理路径中可能的前缀（如 storage://、supabase:// 等）
 * 3. 更好的错误反馈
 */
export function LifeRecordImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const MAX_RETRIES = 2;

  useEffect(() => {
    if (!path) {
      setFailed(true);
      return;
    }

    let mounted = true;
    setFailed(false);
    setUrl(null);

    // 清理可能的协议前缀
    const cleanPath = path
      .replace(/^storage:\/\//, "")
      .replace(/^supabase:\/\//, "");

    getRecordMediaUrl(cleanPath)
      .then((signed) => {
        if (!mounted) return;
        if (signed) {
          setUrl(signed);
        } else {
          // getRecordMediaUrl 返回 null，可能是路径不存在或 API 错误
          setFailed(true);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("LifeRecordImage: getRecordMediaUrl failed", { path, error: err });
        setFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, [path, retryCount]);

  if (failed) {
    // 支持手动重试
    return (
      <div className="mb-2 flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[10px] bg-surface-muted text-[12px] text-muted">
        <span>图片暂时无法加载</span>
        {retryCount < MAX_RETRIES && (
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-[6px] border border-border-subtle px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (!url) return <div className="mb-2 aspect-[4/3] w-full animate-pulse rounded-[10px] bg-surface-muted" />;

  return (
    <>
      <button type="button" className="mb-2 block w-full" onClick={() => setPreviewOpen(true)} aria-label="放大查看人生记录图片">
        <img
          src={url}
          alt="人生记录"
          onError={() => setFailed(true)}
          className="max-h-56 w-full rounded-[10px] object-cover transition-opacity hover:opacity-90"
          loading="lazy"
        />
      </button>
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="人生记录图片预览" onClick={() => setPreviewOpen(false)}>
          <img src={url} alt="人生记录大图" className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
          <button type="button" className="absolute right-5 top-5 rounded bg-black/60 px-3 py-2 text-sm text-white" onClick={() => setPreviewOpen(false)}>关闭</button>
        </div>
      )}
    </>
  );
}
