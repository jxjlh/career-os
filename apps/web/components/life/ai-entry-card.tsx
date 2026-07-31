"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

export function AiEntryCard() {
  return (
    <Link
      href="/life/assistant"
      className="block rounded-[12px] border border-border bg-gradient-to-br from-ai/10 to-blue-500/10 p-4 transition-colors hover:border-ai/40"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-ai/10 text-ai">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">🤖 今日人生助手</p>
          <p className="text-[13px] text-muted">每天为你梳理最重要的一件事</p>
        </div>
      </div>
    </Link>
  );
}
