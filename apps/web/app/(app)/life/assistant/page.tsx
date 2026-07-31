"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

import { DailyAssistantCard } from "@/components/life/assistant/daily-assistant-card";
import { Button } from "@/components/ui";

export default function LifeAssistantPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">AI 人生助手</h1>
          <p className="text-[13px] text-muted">每天为你梳理最重要的一件事</p>
        </div>
      </div>

      <DailyAssistantCard detailed />

      <Link
        href="/life/review"
        className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-primary" />
          年度人生总结
        </span>
        <span className="text-xs text-muted">回顾一整年 →</span>
      </Link>
    </div>
  );
}
