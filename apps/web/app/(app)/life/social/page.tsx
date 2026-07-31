"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, PenLine, Plus, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CreatePostSheet } from "@/components/life/social/create-post-sheet";
import { CreateSharedGoalSheet } from "@/components/life/social/create-shared-goal-sheet";
import { FeedCard } from "@/components/life/social/feed-card";
import { SharedGoalCard } from "@/components/life/social/shared-goal-card";
import { SocialOverviewCard } from "@/components/life/social/social-overview-card";
import { Button, EmptyState, Skeleton } from "@/components/life/social/ui-extras";
import { apiFetch } from "@/lib/api";
import { getFeed, getSocialOverview, listSharedGoals } from "@/lib/social";

interface ProfileEnvelope {
  data: { id: string; nickname?: string | null; avatar?: string | null };
}

/**
 * Life Social 首页: 概览 + 共同目标 + 好友动态 Feed.
 * 顶部入口可发布动态 / 发起共同目标.
 */
export default function SocialHomePage() {
  const [postOpen, setPostOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);

  const overview = useQuery({ queryKey: ["social-overview"], queryFn: getSocialOverview });
  const profile = useQuery<ProfileEnvelope>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
  });
  const shared = useQuery({ queryKey: ["social-shared-goals"], queryFn: listSharedGoals });
  const feed = useQuery({ queryKey: ["social-feed"], queryFn: () => getFeed(0, 20) });

  const currentUserId = profile.data?.data?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSharedOpen(true)}>
            <Plus className="h-4 w-4" />
            共同目标
          </Button>
          <Button size="sm" onClick={() => setPostOpen(true)}>
            <PenLine className="h-4 w-4" />
            发布动态
          </Button>
        </div>
      </div>

      {/* 页头 */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">🌐</span>
        <div>
          <h1 className="text-xl font-semibold">人生社交</h1>
          <p className="text-[13px] text-muted">分享成长 · 共同完成 · 互相激励</p>
        </div>
      </div>

      {/* 概览卡 */}
      <SocialOverviewCard />

      {/* 快捷入口 */}
      <div className="grid grid-cols-3 gap-2">
        <QuickLink href="/life/friends" icon="👥" label="好友" />
        <QuickLink href="/life/shared" icon="🎯" label="共同目标" badge={shared.data?.length} />
        <QuickLink href="/life/ranking" icon="🏆" label="排行榜" />
      </div>

      {/* 共同目标预览 */}
      {shared.isLoading ? (
        <Skeleton className="h-20 rounded-[14px]" />
      ) : shared.data && shared.data.length > 0 ? (
        <section>
          <SectionTitle title="我的共同目标" action={
            <Link href="/life/shared" className="text-xs text-primary hover:opacity-80">
              查看全部 →
            </Link>
          } />
          <div className="grid gap-3 sm:grid-cols-2">
            {shared.data.slice(0, 2).map((g) =>
              currentUserId ? (
                <SharedGoalCard key={g.id} goal={g} currentUserId={currentUserId} />
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {/* Feed */}
      <section>
        <SectionTitle title="动态" action={
          feed.isError ? (
            <Button variant="ghost" size="sm" onClick={() => feed.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> 重试
            </Button>
          ) : null
        } />

        {feed.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-[16px]" />
            ))}
          </div>
        ) : feed.data && feed.data.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {feed.data.map((post, i) => (
                <Link key={post.id} href={`/life/post/${post.id}`}>
                  <FeedCard post={post} index={i} />
                </Link>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            title="还没有动态"
            description="分享你的第一个成长瞬间, 或邀请好友一起加入。"
            action={
              <Button size="sm" onClick={() => setPostOpen(true)}>
                <PenLine className="h-4 w-4" />
                发布第一条动态
              </Button>
            }
          />
        )}
      </section>

      {/* 好友完成情况 (无动态时的兜底展示) */}
      {overview.data && overview.data.friendsCount === 0 && (
        <EmptyState
          title="还没有好友"
          description="邀请志趣相投的伙伴, 一起完成人生目标。"
          action={
            <Link href="/life/friends">
              <Button size="sm">
                <Users className="h-4 w-4" />
                去添加好友
              </Button>
            </Link>
          }
        />
      )}

      <CreatePostSheet open={postOpen} onClose={() => setPostOpen(false)} />
      <CreateSharedGoalSheet open={sharedOpen} onClose={() => setSharedOpen(false)} />
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[12px] border border-border bg-surface p-3.5 transition-colors hover:border-primary/40"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-lg">{icon}</span>
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-primary/10 px-1.5 text-xs text-primary">{badge}</span>
      )}
    </Link>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action}
    </div>
  );
}
