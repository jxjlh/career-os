"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CloudSun,
  Compass,
  Globe,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  Thermometer,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { LifeMapClient } from "@/components/life/map/life-map-client";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { getMapMarkerDetail } from "@/lib/life-map";
import type { MapMarker } from "@/lib/life-map";

export default function MapDetailPage() {
  const params = useParams<{ id: string }>();
  const markerId = params.id;

  const query = useQuery({
    queryKey: ["map-marker", markerId],
    queryFn: () => getMapMarkerDetail(markerId),
    enabled: !!markerId,
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="找不到该足迹"
          description="该标记可能已删除或链接有误。"
          action={
            <Link href="/life/map">
              <Button>
                <ArrowLeft className="h-4 w-4" />
                返回地图
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const detail = query.data as Record<string, unknown>;
  const markerType = (detail.markerType as string) || "record";
  const title = (detail.title as string) || "未命名足迹";
  const latitude = detail.latitude as number | null | undefined;
  const longitude = detail.longitude as number | null | undefined;
  const hasLocation = latitude != null && longitude != null;
  const visitTime = detail.visitTime as string | null | undefined;
  const createdAt = detail.createdAt as string | null | undefined;
  const city = detail.city as string | null | undefined;
  const country = detail.country as string | null | undefined;
  const weather = detail.weather as string | null | undefined;
  const temperature = detail.temperature as number | null | undefined;
  const altitude = detail.altitude as number | null | undefined;
  const coverImage = detail.coverImage as string | null | undefined;
  const photoUrl = detail.photoUrl as string | null | undefined;
  const content = detail.content as string | null | undefined;
  const lifeGoalId = detail.lifeGoalId as string | null | undefined;
  const goalTitle = detail.goalTitle as string | null | undefined;
  const bucketItemId = detail.bucketItemId as string | null | undefined;
  const difficulty = detail.difficulty as number | null | undefined;
  const estimatedCost = detail.estimatedCost as string | null | undefined;
  const bestSeason = detail.bestSeason as string | null | undefined;
  const category = detail.category as string | null | undefined;
  const tags = Array.isArray(detail.tags) ? (detail.tags as string[]) : [];
  const travelTags = ["旅行", "travel", "海岛", "潜水", "极光"];
  const isTravel = category === "travel" || tags.some((t) => travelTags.includes(t));

  // 用于地图单点展示的合成 marker
  const mapMarker: MapMarker = {
    id: markerId,
    sourceType: (markerType as MapMarker["sourceType"]) || "record",
    sourceId: markerId,
    title,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    photosCount: photoUrl ? 1 : 0,
    videosCount: 0,
    status: "completed",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/life/map">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 顶部地图 */}
      {hasLocation && (
        <div className="overflow-hidden rounded-[16px] border border-border">
          <div className="h-[260px] w-full">
            <LifeMapClient markers={[mapMarker]} showPolyline={false} useCluster={false} />
          </div>
        </div>
      )}

      {/* 标题 + 类型 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">
            {markerType === "record" ? "人生记录" : markerType === "goal" ? "人生目标" : markerType === "bucket" ? "必做清单" : "访问点"}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {content && <p className="text-[14px] leading-relaxed text-muted">{content}</p>}
      </div>

      {/* 封面/照片 */}
      {(coverImage || photoUrl) && (
        <div className="overflow-hidden rounded-[14px] border border-border">
          <LifeRecordImage path={coverImage || photoUrl || ""} />
        </div>
      )}

      {/* 关键信息 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard icon={<Calendar className="h-4 w-4 text-primary" />} label="时间" value={formatDate(visitTime || createdAt)} />
        <InfoCard icon={<Globe className="h-4 w-4 text-success" />} label="地区" value={[country, city].filter(Boolean).join(" · ") || "未知"} />
        <InfoCard icon={<CloudSun className="h-4 w-4 text-warning" />} label="天气" value={weather || "未记录"} />
        <InfoCard icon={<Thermometer className="h-4 w-4 text-danger" />} label="温度/海拔" value={temperature != null ? `${temperature}°` : altitude != null ? `${altitude}m` : "未记录"} />
      </div>

      {/* GPS 坐标 */}
      {hasLocation && (
        <div className="flex items-center gap-2 rounded-[12px] bg-surface-muted p-3 text-[12px] text-muted">
          <MapPin className="h-4 w-4 text-primary" />
          <span>GPS: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
        </div>
      )}

      {/* 关联信息 */}
      {(lifeGoalId || bucketItemId || goalTitle) && (
        <div className="rounded-[14px] border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">关联</h2>
          <div className="space-y-2">
            {lifeGoalId && (
              <Link href={`/life/goals/${lifeGoalId}`} className="flex items-center justify-between rounded-[10px] bg-surface-muted p-2.5 transition-colors hover:bg-primary/5">
                <span className="flex items-center gap-2 text-[13px]">
                  🎯 {goalTitle || "人生目标"}
                </span>
                <span className="text-[11px] text-muted">查看 →</span>
              </Link>
            )}
            {bucketItemId && (
              <Link href={`/life/bucket/${bucketItemId}`} className="flex items-center justify-between rounded-[10px] bg-surface-muted p-2.5 transition-colors hover:bg-primary/5">
                <span className="flex items-center gap-2 text-[13px]">
                  ✅ 必做清单
                </span>
                <span className="text-[11px] text-muted">查看 →</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Bucket 详情扩展信息 */}
      {markerType === "bucket" && (difficulty || estimatedCost || bestSeason) && (
        <div className="grid grid-cols-3 gap-3">
          {difficulty != null && (
            <div className="rounded-[10px] border border-border bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">难度</p>
              <p className="text-sm font-semibold">{"★".repeat(difficulty)}</p>
            </div>
          )}
          {estimatedCost && (
            <div className="rounded-[10px] border border-border bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">预算</p>
              <p className="text-sm font-semibold">{estimatedCost}</p>
            </div>
          )}
          {bestSeason && (
            <div className="rounded-[10px] border border-border bg-surface p-3 text-center">
              <p className="text-[11px] text-muted">最佳季节</p>
              <p className="text-sm font-semibold">{bestSeason}</p>
            </div>
          )}
        </div>
      )}

      {/* AI 旅行攻略入口 */}
      {lifeGoalId && isTravel && (
        <div className="rounded-[14px] border border-ai/20 bg-gradient-to-br from-ai/5 to-transparent p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ai" />
            <span className="text-sm font-semibold">AI 智能规划</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">让 AI 为这个目的地定制详细攻略与每日行程。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/life/goals/${lifeGoalId}/ai`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                生成 AI 旅行攻略
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 人生记录入口 */}
      {lifeGoalId && (
        <div className="flex items-center gap-2 rounded-[14px] border border-dashed border-border p-4">
          <ImageIcon className="h-4 w-4 text-muted" />
          <span className="text-[12px] text-muted">为这个足迹添加照片、视频与心得记录</span>
          <Link href={`/life/records?goal_id=${lifeGoalId}`}>
            <Button variant="outline" size="sm" className="ml-auto">
              添加记录
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-muted">{label}</span>
      </div>
      <p className="mt-1 truncate text-[13px] font-medium">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "未记录";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
