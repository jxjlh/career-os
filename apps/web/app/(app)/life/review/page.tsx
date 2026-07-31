"use client";

import { ArrowLeft, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ShareReviewDialog } from "@/components/life/review/share-review-dialog";
import { YearReviewAchievement } from "@/components/life/review/year-review-achievement";
import { YearReviewEmpty } from "@/components/life/review/year-review-empty";
import { YearReviewFooter } from "@/components/life/review/year-review-footer";
import { YearReviewForm } from "@/components/life/review/year-review-form";
import { YearReviewGrowthChart } from "@/components/life/review/year-review-growth-chart";
import { YearReviewHero } from "@/components/life/review/year-review-hero";
import { YearReviewMemoryWall } from "@/components/life/review/year-review-memory-wall";
import { YearReviewSkeleton } from "@/components/life/review/year-review-skeleton";
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
  const [shareOpen, setShareOpen] = useState(false);

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
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
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
        {review && !loading && (
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            分享
          </Button>
        )}
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
          <YearReviewHero review={review} />
          <YearReviewGrowthChart statistics={review.statistics || {}} />
          <YearReviewAchievement achievements={review.achievements || []} />
          <YearReviewMemoryWall memories={review.memories || []} />
          <YearReviewFooter reflection={review.reflection} nextYearPlan={review.nextYearPlan || []} />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setReview(null)}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新生成
            </Button>
          </div>
          <ShareReviewDialog review={review} open={shareOpen} onOpenChange={setShareOpen} />
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
