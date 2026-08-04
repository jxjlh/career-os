"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { FeedCard } from "@/components/life/social/feed-card";
import { ShareSheet } from "@/components/life/social/share-sheet";
import { Button, EmptyState, Skeleton } from "@/components/life/social/ui-extras";
import { getPost } from "@/lib/social";

/**
 * 动态详情页: 单条动态 + 点赞 + 评论展开.
 * 可分享(复制链接 / 二维码 / 文案).
 */
export default function PostDetailPage() {
  const [shareOpen, setShareOpen] = useState(false);
  const params = useParams<{ id: string }>();
  const id = params.id;

  const post = useQuery({
    queryKey: ["social-post", id],
    queryFn: () => getPost(id),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/life/social">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShareOpen(true)}
          disabled={!post.data}
        >
          <Share2 className="h-4 w-4" />
          分享
        </Button>
      </div>

      {post.isLoading ? (
        <Skeleton className="h-64 rounded-[16px]" />
      ) : post.isError ? (
        <EmptyState
          title="动态加载失败"
          description="可能已被删除, 或你没有查看权限。"
          action={
            <Button onClick={() => post.refetch()}>
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          }
        />
      ) : post.data ? (
        <>
          <FeedCard post={post.data} />
          <ShareSheet
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            path={`/life/post/${id}`}
            title={post.data.content?.slice(0, 60) || "来 AI LifeOS 看我的动态"}
            description={post.data.content ?? undefined}
          />
        </>
      ) : null}
    </div>
  );
}
