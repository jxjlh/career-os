"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { YearReviewForm } from "@/components/life/ai/year-review-form";
import { YearReviewView } from "@/components/life/ai/year-review-view";
import { Button, Card, Skeleton } from "@/components/ui";
import { generateYearReview, getYearReview, type YearReviewResponse } from "@/lib/life";

export default function LifeReviewPage() {
  const year = new Date().getFullYear();
  const [review, setReview] = useState<YearReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getYearReview(year)
      .then((result) => {
        if (active) setReview(result);
      })
      .catch(() => {
        if (active) setReview(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);

  const generate = useCallback(async (targetYear: number) => {
    setGenerating(true);
    setError(null);
    try {
      setReview(await generateYearReview(targetYear));
    } catch {
      setError("AI 生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">年度人生总结</h1>
          <p className="text-[13px] text-muted">让 AI 回顾你这一年的成长</p>
        </div>
      </div>

      {loading && <Skeleton className="h-64" />}
      {!loading && !generating && !review && <YearReviewForm onGenerate={generate} loading={false} />}
      {generating && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">AI 正在回顾你的一年...</p>
        </Card>
      )}
      {review && <YearReviewView review={review} onRegenerate={() => generate(review.year)} />}
      {error && !generating && (
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" onClick={() => setError(null)}>
            返回重试
          </Button>
        </Card>
      )}
    </div>
  );
}
