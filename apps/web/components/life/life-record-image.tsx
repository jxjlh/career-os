"use client";

import { useEffect, useState } from "react";

import { getRecordMediaUrl } from "@/lib/life";

export function LifeRecordImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    setFailed(false);
    setUrl(null);
    getRecordMediaUrl(path).then((signed) => {
      if (!mounted) return;
      if (signed) setUrl(signed);
      else setFailed(true);
    });
    return () => {
      mounted = false;
    };
  }, [path]);
  if (failed) {
    return (
      <div className="mb-2 flex aspect-[4/3] w-full items-center justify-center rounded-[10px] bg-surface-muted text-[12px] text-muted">
        图片暂时无法加载
      </div>
    );
  }
  if (!url) return <div className="mb-2 aspect-[4/3] w-full animate-pulse rounded-[10px] bg-surface-muted" />;
  return (
    <img
      src={url}
      alt="人生记录"
      onError={() => setFailed(true)}
      className="mb-2 max-h-56 w-full rounded-[10px] object-cover"
    />
  );
}
