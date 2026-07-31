"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, QrCode, Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AiFriendRecommendation } from "@/components/life/social/ai-friend-recommendation";
import {
  FriendCard,
  FriendRequestCard,
  ProfileSearchCard,
} from "@/components/life/social/friend-card";
import { ShareSheet } from "@/components/life/social/share-sheet";
import { Button, EmptyState, Input, Skeleton } from "@/components/life/social/ui-extras";
import { apiFetch } from "@/lib/api";
import {
  listFriendRequests,
  listFriends,
  searchProfiles,
  sendFriendRequest,
  type ProfileSearchItem,
} from "@/lib/social";

interface ProfileEnvelope {
  data: { id: string; nickname?: string | null };
}

/**
 * 好友页: 搜索(昵称/邮箱) + 好友申请 + 好友列表 + 分享邀请码/二维码 + AI 推荐.
 */
export default function FriendsPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const queryClient = useQueryClient();
  const friends = useQuery({ queryKey: ["social-friends"], queryFn: listFriends });
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: listFriendRequests,
  });
  const profile = useQuery<ProfileEnvelope>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
  });
  const search = useQuery({
    queryKey: ["social-search", debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: debounced.trim().length >= 1,
  });

  const send = useMutation({
    mutationFn: (item: ProfileSearchItem) =>
      sendFriendRequest({ toUserId: item.id, message: "一起成长吧!" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-search", debounced] });
      queryClient.invalidateQueries({ queryKey: ["social-requests"] });
    },
  });

  const inviteCode = profile.data?.data?.id?.slice(0, 8).toUpperCase() ?? "LIFEOS";
  const invitePath = `/life/social`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/life/social">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
          <QrCode className="h-4 w-4" />
          邀请码
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl">👥</span>
        <div>
          <h1 className="text-xl font-semibold">好友</h1>
          <p className="text-[13px] text-muted">搜索 · 邀请 · 一起成长</p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="搜索昵称或邮箱…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 搜索结果 */}
      <AnimatePresence>
        {debounced.trim() && (
          <section>
            <p className="mb-2 text-xs text-muted">搜索结果</p>
            {search.isLoading && <Skeleton className="h-16" />}
            {search.data && search.data.length > 0 ? (
              <div className="space-y-2">
                {search.data.map((item) => (
                  <ProfileSearchCard key={item.id} item={item} onSend={(i) => send.mutate(i)} />
                ))}
              </div>
            ) : (
              search.data &&
              search.data.length === 0 && (
                <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">
                  没有找到匹配的用户
                </p>
              )
            )}
          </section>
        )}
      </AnimatePresence>

      {/* 好友申请 */}
      {!debounced.trim() && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <UserPlus className="h-3.5 w-3.5" />
              好友申请
              {requests.data && requests.data.length > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-primary">
                  {requests.data.length}
                </span>
              )}
            </p>
          </div>
          {requests.isLoading ? (
            <Skeleton className="h-20" />
          ) : requests.data && requests.data.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence>
                {requests.data.map((r) => (
                  <FriendRequestCard key={r.id} request={r} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">
              暂无新的好友申请
            </p>
          )}
        </section>
      )}

      {/* 好友列表 */}
      {!debounced.trim() && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Users className="h-3.5 w-3.5" />
              我的好友
              {friends.data && (
                <span className="text-muted">({friends.data.length})</span>
              )}
            </p>
          </div>
          {friends.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : friends.data && friends.data.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence>
                {friends.data.map((f) => (
                  <FriendCard key={f.profile.id} friend={f} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState
              title="还没有好友"
              description="搜索昵称或邮箱添加好友, 或使用邀请码邀请伙伴。"
              action={
                <Button size="sm" onClick={() => setShareOpen(true)}>
                  <QrCode className="h-4 w-4" />
                  生成邀请码
                </Button>
              }
            />
          )}
        </section>
      )}

      {/* AI 推荐 */}
      {!debounced.trim() && search.data && (
        <AiFriendRecommendation friends={search.data} />
      )}
      {!debounced.trim() && !search.data && friends.data && (
        <AiFriendRecommendation friends={[]} />
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        path={invitePath}
        title="来 AI LifeOS 一起成长"
        description={`我的邀请码: ${inviteCode}`}
        showCopywriting={false}
      />
    </div>
  );
}
