"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { YearReviewContent } from "@/components/life/review/year-review-content";
import { YearReviewCover } from "@/components/life/review/year-review-cover";
import { YearReviewEmpty } from "@/components/life/review/year-review-empty";
import { YearReviewForm } from "@/components/life/review/year-review-form";
import { YearReviewSkeleton } from "@/components/life/review/year-review-skeleton";
import { YearReviewStatistics } from "@/components/life/review/year-review-statistics";
import { Button, Card } from "@/components/ui";
import {
  generateYearReview,
  type YearReviewResponse,
  type YearReviewStyle,
} from "@/lib/life";

export default function LifeReviewPage() {
  const [review, setReview] = useState<YearReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (year: number, style: YearReviewStyle) => {
    setLoading(true);
    setError(null);
    try {
      setReview(await generateYearReview({ year, style }));
    } catch {
      setError("生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">年度人生报告</h1>
          <p className="text-[13px] text-muted">让 AI 回顾你这一年的成长</p>
        </div>
      </div>

      {error && !loading && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>
            <RefreshCw className="h-3.5 w-3.5" />
            重新尝试
          </Button>
        </Card>
      )}

      {loading ? (
        <YearReviewSkeleton />
      ) : review ? (
        <>
          <YearReviewCover year={review.year} title={review.title} summary={review.summary} />
          <YearReviewStatistics statistics={review.statistics || {}} />
          <YearReviewContent review={review} />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setReview(null)}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新生成
            </Button>
          </div>
        </>
      ) : (
        <>
          <YearReviewEmpty />
          <YearReviewForm onGenerate={generate} loading={loading} />
        </>
      )}
    </div>
  );
}
