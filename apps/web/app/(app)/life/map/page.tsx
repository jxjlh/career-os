"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";

import { LifeMapClient } from "@/components/life/map/life-map-client";
import { Badge, Button, Card, EmptyState, SectionHeader, Skeleton, StatCard } from "@/components/ui";
import { getLifeMap } from "@/lib/life";

export default function LifeMapPage() {
  const query = useQuery({ queryKey: ["life-map"], queryFn: getLifeMap });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="mb-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-[480px] w-full sm:h-[560px]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          title="加载人生地图失败"
          description="无法获取带坐标的人生记录, 请稍后重试。"
          action={
            <Button onClick={() => query.refetch()}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          }
        />
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;

  const { summary, cities, records, destinations } = data;
  const isEmpty = summary.totalRecords === 0 && summary.totalDestinations === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="mb-1 flex items-center gap-3">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <SectionHeader
        title="人生地图"
        subtitle="在世界地图上标注你记录过的人生瞬间与目标目的地"
      />

      {isEmpty ? (
        <EmptyState
          title="地图上还没有足迹"
          description="为人生记录或目标添加位置信息(城市 + 经纬度), 你的足迹会在此可视化呈现。"
          action={
            <Link href="/life/records">
              <Button>
                <MapPin className="h-4 w-4" />
                去记录人生瞬间
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="人生瞬间" value={summary.totalRecords} icon={<MapPin className="h-4 w-4 text-primary" />} />
            <StatCard label="到访城市" value={summary.totalCities} />
            <StatCard label="国家/地区" value={summary.totalCountries} />
            <StatCard
              label="目标目的地"
              value={summary.totalDestinations}
              icon={<Flag className="h-4 w-4 text-warning" />}
            />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <span className="text-sm font-medium">足迹地图</span>
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                  人生瞬间
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[13px]">📍</span>
                  目的地
                </span>
              </div>
            </div>
            <div className="h-[460px] w-full sm:h-[560px]">
              <LifeMapClient records={records} destinations={destinations} />
            </div>
          </Card>

          {cities.length > 0 && (
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">城市足迹</span>
                <Badge variant="primary">共 {cities.length} 个城市</Badge>
              </div>
              <ul className="divide-y divide-border">
                {cities.map((city) => (
                  <li key={`${city.country ?? ""}-${city.city}`} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
                      {city.recordCount}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {city.city}
                          {city.country ? <span className="ml-1 text-muted">· {city.country}</span> : null}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted">{city.recordCount} 条记录</span>
                      </div>
                      {city.latestContent && (
                        <p className="mt-0.5 truncate text-[13px] text-muted">{city.latestContent}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
