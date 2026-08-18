"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QrCode, Search, UserPlus, Users } from "lucide-react";

import { AiFriendRecommendation } from "@/components/life/social/ai-friend-recommendation";
import {
  FriendCard,
  FriendRequestCard,
  ProfileSearchCard,
} from "@/components/life/social/friend-card";
import { ShareSheet } from "@/components/life/social/share-sheet";
import { Button, Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  listFriendRequests,
  listFriends,
  searchProfiles,
  sendFriendRequest,
  type ProfileSearchItem,
} from "@/lib/social";

export default function ContactsPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const friends = useQuery({ queryKey: ["social-friends"], queryFn: listFriends });
  const requests = useQuery({ queryKey: ["social-requests"], queryFn: listFriendRequests });
  const profile = useQuery<{ data: { id: string } }>({
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
      void queryClient.invalidateQueries({ queryKey: ["social-search", debounced] });
      void queryClient.invalidateQueries({ queryKey: ["social-requests"] });
    },
  });

  const inviteCode = profile.data?.data?.id?.slice(0, 8).toUpperCase() ?? "LIFEOS";
  const recommendationProfiles: ProfileSearchItem[] = (friends.data ?? []).map((friend) => ({
    id: friend.profile.id,
    displayName: friend.profile.displayName,
    avatarUrl: friend.profile.avatarUrl,
    currentTitle: null,
    isFriend: true,
    requestPending: false,
  }));

  return (
    <div className="min-h-screen bg-[#09090B]">
      <div className="mx-auto max-w-3xl space-y-5 p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📇</span>
            <div>
              <h1 className="text-xl font-semibold">联系人</h1>
              <p className="text-[13px] text-muted">好友 · 一起成长</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)} aria-label="生成邀请码">
            <QrCode className="h-4 w-4" />
          </Button>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="搜索昵称或邮箱…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        {debounced.trim() ? (
          <section>
            <p className="mb-2 text-xs text-muted">搜索结果</p>
            {search.isLoading && <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />}
            {search.data?.length ? (
              <div className="space-y-2">
                {search.data.map((item) => <ProfileSearchCard key={item.id} item={item} onSend={(candidate) => send.mutate(candidate)} />)}
              </div>
            ) : search.data ? (
              <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">没有找到匹配的用户</p>
            ) : null}
          </section>
        ) : (
          <>
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><UserPlus className="h-3.5 w-3.5" />好友申请{requests.data?.length ? <span className="rounded-full bg-primary/10 px-1.5 text-primary">{requests.data.length}</span> : null}</p>
              {requests.isLoading ? <div className="h-20 animate-pulse rounded-lg bg-surface-muted" /> : requests.data?.length ? <div className="space-y-2">{requests.data.map((request) => <FriendRequestCard key={request.id} request={request} />)}</div> : <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">暂无新的好友申请</p>}
            </section>
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Users className="h-3.5 w-3.5" />我的好友{friends.data ? <span>({friends.data.length})</span> : null}</p>
              {friends.isLoading ? <div className="space-y-2"><div className="h-16 animate-pulse rounded-lg bg-surface-muted" /><div className="h-16 animate-pulse rounded-lg bg-surface-muted" /></div> : friends.data?.length ? <div className="space-y-2">{friends.data.map((friend) => <FriendCard key={friend.profile.id} friend={friend} />)}</div> : <div className="rounded-lg border border-dashed border-border p-8 text-center"><p className="text-sm text-muted">还没有好友</p><p className="mt-1 text-xs text-muted">搜索昵称或邮箱添加好友，或使用邀请码邀请伙伴。</p><Button size="sm" onClick={() => setShareOpen(true)} className="mt-3"><QrCode className="h-4 w-4" />生成邀请码</Button></div>}
            </section>
            <AiFriendRecommendation friends={recommendationProfiles} />
          </>
        )}

        <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} path="/life/social" title="来 AI LifeOS 一起成长" description={`我的邀请码: ${inviteCode}`} showCopywriting={false} />
      </div>
    </div>
  );
}
