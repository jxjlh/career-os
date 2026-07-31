"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AiRecommendation } from "@/components/life/bucket/ai-recommendation";
import { BucketCard } from "@/components/life/bucket/bucket-card";
import { BucketHero } from "@/components/life/bucket/bucket-hero";
import { BucketSearchBar, type BucketSearchState } from "@/components/life/bucket/bucket-search-bar";
import { CategoryBar } from "@/components/life/bucket/category-bar";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { getBucketCategories, getBucketItems, getBucketProgress } from "@/lib/bucket";

/** 简易防抖 hook, 避免搜索框每次按键都发请求. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BucketListPage() {
  const [search, setSearch] = useState<BucketSearchState>({
    q: "",
    sort: "popular",
    difficulty: undefined,
    completed: undefined,
  });
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  // 搜索输入防抖 350ms, 避免每键一次请求
  const debouncedQ = useDebounced(search.q, 350);

  const progressQuery = useQuery({ queryKey: ["bucket-progress"], queryFn: getBucketProgress });
  const categoriesQuery = useQuery({ queryKey: ["bucket-categories"], queryFn: getBucketCategories });

  const itemsQuery = useQuery({
    queryKey: ["bucket-items", categoryId, debouncedQ, search.sort, search.difficulty, search.completed],
    queryFn: () =>
      getBucketItems({
        q: debouncedQ || undefined,
        categoryId,
        difficulty: search.difficulty,
        completed: search.completed,
        sort: search.sort,
        pageSize: 50,
      }),
    placeholderData: (prev) => prev,
  });

  const isInitialLoading =
    progressQuery.isLoading || categoriesQuery.isLoading || itemsQuery.isLoading;

  if (isInitialLoading && !itemsQuery.data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-44 rounded-[20px]" />
        <Skeleton className="h-20" />
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="mb-3 h-56 rounded-[16px]" />
          ))}
        </div>
      </div>
    );
  }

  if (progressQuery.isError || itemsQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          title="加载清单失败"
          description="无法获取人生必做清单数据, 请稍后重试。"
          action={
            <Button onClick={() => itemsQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          }
        />
      </div>
    );
  }

  const items = itemsQuery.data?.items ?? [];
  const total = itemsQuery.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {progressQuery.data && <BucketHero progress={progressQuery.data} />}

      <AiRecommendation />

      {categoriesQuery.data && (
        <CategoryBar
          categories={categoriesQuery.data}
          activeId={categoryId}
          onSelect={setCategoryId}
        />
      )}

      <BucketSearchBar value={search} onChange={setSearch} />

      {/* 结果计数 */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">
          共 {total} 项{categoryId ? " · 当前分类" : ""}
          {debouncedQ && ` · 搜索 "${debouncedQ}"`}
        </p>
      </div>

      {/* 瀑布流: CSS columns 实现移动端优先 + 响应式 */}
      {items.length === 0 ? (
        <EmptyState title="没有匹配的清单" description="尝试调整搜索关键词或筛选条件。" />
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {items.map((item, idx) => (
            <BucketCard key={item.id} item={item} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
