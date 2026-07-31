"use client";

import { motion } from "framer-motion";
import { Images, Link2, ListChecks, Lock, Users } from "lucide-react";
import Link from "next/link";

import { CommentList } from "@/components/life/social/comment-list";
import { LikeButton } from "@/components/life/social/like-button";
import { Avatar, Chip, cn } from "@/components/life/social/ui-extras";
import { VISIBILITY_LABELS, type SocialPost } from "@/lib/social";

interface FeedCardProps {
  post: SocialPost;
  index?: number;
}

/**
 * 动态卡片: Feed 主体展示单元.
 * 进入视口时以 Slide + Fade 组合动画呈现, 点击进入详情页.
 * 联动 Life Record / Bucket / 目标 / 地图数据.
 */
export function FeedCard({ post, index = 0 }: FeedCardProps) {
  const hasMedia = post.photos.length > 0 || post.videos.length > 0;
  const hasGoalLink = Boolean(post.lifeRecordId) || Boolean(post.bucketItemId);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
      className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      {/* 头部: 作者信息 + 可见性 */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Avatar
            name={post.user.displayName}
            avatarUrl={post.user.avatarUrl}
            size={40}
          />
          <div>
            <p className="text-sm font-semibold">{post.user.displayName}</p>
            <p className="text-xs text-muted">
              {post.user.currentTitle || "探索者"} · {formatRelative(post.createdAt)}
            </p>
          </div>
        </div>
        <VisibilityChip visibility={post.visibility} />
      </div>

      {/* 正文 */}
      {post.content && (
        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[14px] leading-relaxed">
          {post.content}
        </p>
      )}

      {/* 媒体网格 */}
      {hasMedia && <MediaGrid photos={post.photos} videos={post.videos} />}

      {/* 关联标签: Life Record / Bucket */}
      {hasGoalLink && (
        <div className="flex flex-wrap gap-2 px-4 py-2">
          {post.lifeRecordId && (
            <Link
              href={`/life/records/${post.lifeRecordId}`}
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            >
              <Chip className="bg-primary/10 text-primary hover:bg-primary/20">
                <Images className="h-3 w-3" />
                人生记录
              </Chip>
            </Link>
          )}
          {post.bucketItemId && (
            <Link
              href={`/life/bucket/${post.bucketItemId}`}
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            >
              <Chip className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20">
                <ListChecks className="h-3 w-3" />
                必做清单
              </Chip>
            </Link>
          )}
        </div>
      )}

      {/* 底部: 点赞 + 评论 */}
      <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2.5">
        <LikeButton
          postId={post.id}
          liked={post.likedByMe}
          likesCount={post.likesCount}
        />
        <CommentList postId={post.id} initialCount={post.commentsCount} />
      </div>
    </motion.article>
  );
}

function VisibilityChip({ visibility }: { visibility: SocialPost["visibility"] }) {
  const Icon =
    visibility === "private"
      ? Lock
      : visibility === "link"
        ? Link2
        : visibility === "public"
          ? Users
          : Users;
  return (
    <Chip className="bg-surface-muted text-muted">
      <Icon className="h-3 w-3" />
      {VISIBILITY_LABELS[visibility]}
    </Chip>
  );
}

function MediaGrid({ photos, videos }: { photos: string[]; videos: string[] }) {
  const total = photos.length + videos.length;
  if (total === 0) return null;
  const cols = total === 1 ? "grid-cols-1" : total === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={cn("grid gap-0.5 px-0", cols)}>
      {photos.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`p-${i}`}
          src={url}
          alt=""
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
      ))}
      {videos.map((url, i) => (
        <div
          key={`v-${i}`}
          className="relative aspect-square w-full overflow-hidden bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <video
            src={url}
            className="h-full w-full object-cover"
            controls
            preload="metadata"
          />
        </div>
      ))}
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}
