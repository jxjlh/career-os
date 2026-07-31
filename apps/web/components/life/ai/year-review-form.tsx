"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";

export function YearReviewForm({
  onGenerate,
  loading,
}: {
  onGenerate: (year: number) => void;
  loading: boolean;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(year);
    if (Number.isInteger(value) && value >= 2000 && value <= 2100) {
      onGenerate(value);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-ai/10 text-ai">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">AI 年度人生总结</p>
          <p className="text-[13px] text-muted">回顾完成的目标、人生记录与成长等级</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="number"
          min={2000}
          max={2100}
          value={year}
          onChange={(event) => setYear(event.target.value)}
          className="sm:max-w-[160px]"
        />
        <Button type="submit" disabled={loading}>
          <Sparkles className="h-4 w-4" />
          生成年度总结
        </Button>
      </form>
    </Card>
  );
}
