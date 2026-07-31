"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LifeMapClient } from "@/components/life/map/life-map-client";
import { MapAiInsight } from "@/components/life/map/map-ai-insight";
import { MapStatistics } from "@/components/life/map/map-statistics";
import { MapTimeline } from "@/components/life/map/map-timeline";
import { Button, Skeleton } from "@/components/ui";
import { getLifeMap, getMapStatistics } from "@/lib/life-map";

export default function LifeMapPage() {
  const [year, setYear] = useState<number | undefined>(undefined);

  const statsQuery = useQuery({ queryKey: ["map-statistics"], queryFn: getMapStatistics });
  const mapQuery = useQuery({
    queryKey: ["life-map", year],
    queryFn: () => getLifeMap({ year }),
  });

  const markers = mapQuery.data?.markers ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 50%, #8B5CF6 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wider opacity-90">LifeOS · Map</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">人生地图</h1>
          <p className="mt-1 text-sm opacity-80">记录每一步成长 · 你的足迹可视化中心</p>
        </div>
      </div>

      {/* 统计 */}
      {statsQuery.isLoading ? (
        <Skeleton className="h-24 rounded-[14px]" />
      ) : statsQuery.data ? (
        <MapStatistics stats={statsQuery.data} />
      ) : null}

      {/* 地图 */}
      <div className="overflow-hidden rounded-[16px] border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium">足迹地图</span>
          <span className="text-[11px] text-muted">{markers.length} 个标记</span>
        </div>
        <div className="h-[420px] w-full sm:h-[500px]">
          {mapQuery.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <LifeMapClient markers={markers} showPolyline useCluster />
          )}
        </div>
      </div>

      {/* 年份过滤 */}
      <div className="flex items-center gap-2">
        <Button
          variant={year === undefined ? "default" : "outline"}
          size="sm"
          onClick={() => setYear(undefined)}
        >
          全部
        </Button>
        {Array.from({ length: 3 }).map((_, i) => {
          const y = new Date().getFullYear() - i;
          return (
            <Button
              key={y}
              variant={year === y ? "default" : "outline"}
              size="sm"
              onClick={() => setYear(year === y ? undefined : y)}
            >
              {y}
            </Button>
          );
        })}
      </div>

      {/* AI 洞察 */}
      <MapAiInsight />

      {/* 时间轴 */}
      <div>
        <h2 className="mb-3 text-base font-semibold">时间轴</h2>
        <MapTimeline markers={markers} />
      </div>
    </div>
  );
}
