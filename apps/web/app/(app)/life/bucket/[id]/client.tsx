"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  Globe,
  Heart,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BucketMapClient } from "@/components/life/bucket/bucket-map-client";
import { JoinButton } from "@/components/life/bucket/join-button";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import {
  difficultyLabel,
  getBucketItem,
  toggleBucketFavorite,
  toggleBucketWishlist,
} from "@/lib/bucket";

export default function BucketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);

  const query = useQuery({
    queryKey: ["bucket-item", id],
    queryFn: () => getBucketItem(id),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bucket-item", id] });
    qc.invalidateQueries({ queryKey: ["bucket-items"] });
    qc.invalidateQueries({ queryKey: ["bucket-progress"] });
  };

  const favMutation = useMutation({
    mutationFn: () => toggleBucketFavorite(id),
    onSuccess: invalidate,
  });
  const wishMutation = useMutation({
    mutationFn: () => toggleBucketWishlist(id),
    onSuccess: invalidate,
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="找不到该清单"
          description="该条目可能已下架或链接有误。"
          action={
            <Link href="/life/bucket">
              <Button>
                <ArrowLeft className="h-4 w-4" />
                返回清单
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const item = query.data;
  const gallery = [item.coverImage, ...item.galleryImages].filter(Boolean) as string[];
  const hasLocation = item.latitude != null && item.longitude != null;
  // 旅行类(有国家/城市或旅行标签)展示 AI 旅行攻略
  const travelTags = ["旅行", "travel", "海岛", "潜水", "极光"];
  const isTravel = (item.tags ?? []).some((t) => travelTags.includes(t)) || !!item.country;
  const joined = item.userState?.joined ?? false;
  const lifeGoalId = item.userState?.lifeGoalId;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/life/bucket">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* 封面视频 / 轮播图 */}
      <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
        {item.videoUrl ? (
          <video src={item.videoUrl} controls className="aspect-[16/9] w-full object-cover" />
        ) : gallery.length > 0 ? (
          <div className="relative">
            <img
              src={gallery[activeImage]}
              alt={item.title}
              className="aspect-[16/10] w-full object-cover"
            />
            {gallery.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeImage ? "w-5 bg-white" : "w-1.5 bg-white/50"
                    }`}
                    aria-label={`图片 ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-indigo-500/15 to-pink-500/15">
            <Sparkles className="h-10 w-10 text-primary/40" />
          </div>
        )}
      </div>

      {/* 标题与基本信息 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>
            {item.subtitle && <p className="mt-1 text-[15px] text-muted">{item.subtitle}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant={item.userState?.favorite ? "default" : "outline"}
              size="icon"
              onClick={() => favMutation.mutate()}
              disabled={!joined || favMutation.isPending}
              title={joined ? "收藏" : "加入后可收藏"}
            >
              <Heart className={`h-4 w-4 ${item.userState?.favorite ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant={item.userState?.wishlist ? "default" : "outline"}
              size="icon"
              onClick={() => wishMutation.mutate()}
              disabled={!joined || wishMutation.isPending}
              title={joined ? "心愿" : "加入后可加入心愿"}
            >
              <Compass className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(item.tags ?? []).map((tag) => (
            <Badge key={tag} variant="primary">
              {tag}
            </Badge>
          ))}
          <Badge variant="default">{difficultyLabel(item.difficulty)}</Badge>
          <Badge variant="default">{item.completedCount} 人完成</Badge>
        </div>
      </div>

      {/* 关键参数 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard icon={<Wallet className="h-4 w-4 text-warning" />} label="预算" value={item.estimatedCost ?? "未知"} />
        <InfoCard icon={<Clock className="h-4 w-4 text-primary" />} label="推荐天数" value={item.estimatedDays ? `${item.estimatedDays} 天` : "灵活"} />
        <InfoCard icon={<Calendar className="h-4 w-4 text-success" />} label="最佳季节" value={item.bestSeason ?? "全年"} />
        <InfoCard icon={<Globe className="h-4 w-4 text-ai" />} label="地区" value={[item.country, item.city].filter(Boolean).join(" · ") || "不限"} />
      </div>

      {/* 介绍 / 故事 */}
      {(item.description || item.story) && (
        <div className="rounded-[14px] border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">为什么值得完成</h2>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted">
            {item.story || item.description}
          </p>
          {item.tips && (
            <div className="mt-3 rounded-[10px] bg-surface-muted p-3">
              <p className="text-[12px] font-medium text-text">小贴士</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{item.tips}</p>
            </div>
          )}
        </div>
      )}

      {/* 地图 */}
      {hasLocation && (
        <div className="overflow-hidden rounded-[14px] border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {item.location || [item.country, item.city].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="h-[280px] w-full">
            <BucketMapClient latitude={item.latitude!} longitude={item.longitude!} label={item.title} />
          </div>
        </div>
      )}

      {/* AI 旅行攻略入口 */}
      {isTravel && (
        <div className="rounded-[14px] border border-ai/20 bg-gradient-to-br from-ai/5 to-transparent p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ai" />
            <span className="text-sm font-semibold">AI 智能规划</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">让 AI 为这次旅行定制详细攻略与每日行程。</p>
          {joined && lifeGoalId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/life/goals/ai?goalId=${lifeGoalId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  生成 AI 旅行攻略
                </Button>
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-muted">加入人生目标后即可生成 AI 攻略</p>
          )}
        </div>
      )}

      {/* 加入按钮 (sticky) */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface/95 p-3 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-[11px] text-muted">
            {joined
              ? item.userState?.completed
                ? "已完成"
                : "已加入人生目标"
              : "加入后自动创建人生目标"}
          </p>
        </div>
        <JoinButton itemId={item.id} joined={joined} lifeGoalId={lifeGoalId} />
      </div>

      {/* 人生记录 (已完成时展示) */}
      {item.userState?.completed && (
        <div className="rounded-[14px] border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">人生记录</h2>
          <p className="text-[12px] text-muted">记录你完成这项人生必做的瞬间: 照片、视频与心得。</p>
          {lifeGoalId && (
            <Link href={`/life/records?goal_id=${lifeGoalId}`}>
              <Button variant="outline" size="sm" className="mt-3">
                查看记录
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* 评论 / 点赞 / 收藏: 预留接口 */}
      <div className="rounded-[14px] border border-dashed border-border p-4 text-center">
        <p className="text-[12px] text-muted">评论区与点赞功能即将上线</p>
      </div>
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
