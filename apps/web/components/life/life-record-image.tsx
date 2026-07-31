"use client";

import { useEffect, useState } from "react";

import { getRecordMediaUrl } from "@/lib/life";

export function LifeRecordImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    getRecordMediaUrl(path).then((signed) => {
      if (mounted) setUrl(signed);
    });
    return () => {
      mounted = false;
    };
  }, [path]);
  if (!url) return null;
  return <img src={url} alt="人生记录" className="mb-2 max-h-56 w-full rounded-[10px] object-cover" />;
}
