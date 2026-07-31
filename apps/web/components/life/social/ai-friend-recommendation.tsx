"use client";

import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Avatar, Button, Chip, Input, Skeleton } from "@/components/life/social/ui-extras";
import {
  recommendFriends,
  sendFriendRequest,
  type FriendRecommendationResponse,
  type ProfileSearchItem,
} from "@/lib/social";

interface RecommendationResult {
  friendId: string;
  reason: string;
  confidence: number;
  profile?: ProfileSearchItem;
}

/**
 * AI 好友推荐: 输入兴趣/目标/城市/方向, AI 推荐可能志趣相投的好友 + 共同目标建议.
 * AI 不可用时后端返回 fallback, 此处统一展示.
 */
export function AiFriendRecommendation({ friends }: { friends: ProfileSearchItem[] }) {
  const [interests, setInterests] = useState("");
  const [city, setCity] = useState("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState<FriendRecommendationResponse | null>(null);

  const recommend = useMutation({
    mutationFn: () =>
      recommendFriends({
        interests: interests ? interests.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [],
        city: city || undefined,
        growthDirection: direction || undefined,
      }),
    onSuccess: setResult,
  });

  const matched = matchRecommendations(result?.recommendations ?? [], friends);
  const suggestions = result?.sharedGoalSuggestions ?? [];

  return (
    <section className="rounded-[14px] border border-ai/30 bg-gradient-to-br from-ai/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-ai" />
        <h3 className="text-sm font-semibold">AI 好友推荐</h3>
        <span className="text-xs text-muted">发现志趣相投的伙伴</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder="兴趣 (摄影, 徒步…)"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="text-[13px]"
        />
        <Input
          placeholder="城市"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="text-[13px]"
        />
        <Input
          placeholder="成长方向"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="text-[13px]"
        />
      </div>

      <Button
        size="sm"
        variant="outline"
        className="mt-3 border-ai/40 text-ai hover:bg-ai/10"
        onClick={() => recommend.mutate()}
        disabled={recommend.isPending}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {recommend.isPending ? "AI 匹配中…" : "为我推荐好友"}
      </Button>

      {recommend.isPending && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      <AnimatePresence>
        {result && !recommend.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {matched.length > 0
                  ? `为你找到 ${matched.length} 位推荐`
                  : "暂无匹配好友, 试试调整条件"}
              </p>
              {result.source === "fallback" && (
                <Chip className="bg-surface-muted text-muted">基础推荐</Chip>
              )}
            </div>

            {matched.map((rec) => (
              <RecommendationRow key={rec.friendId} rec={rec} />
            ))}

            {suggestions.length > 0 && (
              <div className="mt-4 rounded-[10px] bg-surface-muted/50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Users className="h-3 w-3" />
                  共同目标建议
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <Chip key={i} className="bg-primary/10 text-primary">
                      {s.title}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function RecommendationRow({ rec }: { rec: RecommendationResult }) {
  const send = useMutation({
    mutationFn: () => sendFriendRequest({ toUserId: rec.friendId, message: rec.reason }),
  });
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-[10px] border border-border bg-surface p-3"
    >
      <Avatar
        name={rec.profile?.displayName ?? "友"}
        avatarUrl={rec.profile?.avatarUrl}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {rec.profile?.displayName ?? "推荐好友"}
          </p>
          <Chip className="bg-ai/10 text-ai">
            {Math.round(rec.confidence * 100)}% 匹配
          </Chip>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{rec.reason}</p>
      </div>
      {!rec.profile?.isFriend && (
        <Button
          size="sm"
          variant={rec.profile?.requestPending ? "outline" : "default"}
          disabled={rec.profile?.requestPending || send.isPending}
          onClick={() => send.mutate()}
        >
          {rec.profile?.requestPending ? "已申请" : "加好友"}
        </Button>
      )}
    </motion.div>
  );
}

function matchRecommendations(
  recs: FriendRecommendationResponse["recommendations"],
  friends: ProfileSearchItem[],
): RecommendationResult[] {
  return recs.map((rec) => ({
    friendId: rec.friendId,
    reason: rec.reason,
    confidence: rec.confidence,
    profile: friends.find((f) => f.id === rec.friendId),
  }));
}
