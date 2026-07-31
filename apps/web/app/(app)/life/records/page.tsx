"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { LifeRecordEmpty } from "@/components/life/life-record-empty";
import { LifeRecordSkeleton } from "@/components/life/life-record-skeleton";
import { LifeRecordTimeline } from "@/components/life/life-record-timeline";
import { Button } from "@/components/ui";
import { getLifeRecords } from "@/lib/life";

const PAGE_SIZE = 10;

export default function LifeRecordsPage() {
  const query = useInfiniteQuery({
    queryKey: ["life-records"],
    queryFn: ({ pageParam = 1 }) => getLifeRecords(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const records = query.data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">我的人生记录</h1>
          <p className="text-[13px] text-muted">{query.data?.pages[0]?.total ?? 0} 个瞬间</p>
        </div>
      </div>

      {query.isLoading && <LifeRecordSkeleton />}
      {query.isError && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-muted">加载失败</p>
          <Button onClick={() => query.refetch()}>
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </div>
      )}
      {query.isSuccess && records.length === 0 && <LifeRecordEmpty />}
      {records.length > 0 && <LifeRecordTimeline records={records} />}

      <div ref={sentinelRef} className="flex justify-center py-6">
        {query.isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted" />}
        {!query.hasNextPage && records.length > 0 && <p className="text-xs text-muted">已经到底啦</p>}
      </div>
    </div>
  );
}
