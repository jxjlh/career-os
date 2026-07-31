"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AiTeamPlanner } from "@/components/life/social/ai-team-planner";
import { CreateSharedGoalSheet } from "@/components/life/social/create-shared-goal-sheet";
import { SharedGoalCard } from "@/components/life/social/shared-goal-card";
import { Button, EmptyState, Skeleton } from "@/components/life/social/ui-extras";
import { apiFetch } from "@/lib/api";
import { listSharedGoals } from "@/lib/social";

interface ProfileEnvelope {
  data: { id: string };
}

/**
 * 共同目标页: 列表 + 发起入口 + AI 团队规划.
 * 例如一起旅行 / 一起读书 / 一起考研 / 一起跑步.
 */
export default function SharedGoalsPage() {
  const [open, setOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const profile = useQuery<ProfileEnvelope>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
  });
  const shared = useQuery({
    queryKey: ["social-shared-goals"],
    queryFn: listSharedGoals,
  });

  const currentUserId = profile.data?.data?.id;
  const joinedGoals = shared.data?.filter((g) => g.joined || g.owner.id === currentUserId) ?? [];
  const activeGoalId = selectedGoalId ?? joinedGoals[0]?.id;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/life/social">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          发起共同目标
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl">🎯</span>
        <div>
          <h1 className="text-xl font-semibold">共同目标</h1>
          <p className="text-[13px] text-muted">一起旅行 · 一起读书 · 一起成长</p>
        </div>
      </div>

      {/* 示例提示 */}
      <div className="rounded-[12px] border border-dashed border-border bg-surface p-3">
        <p className="text-xs text-muted">
          💡 一起完成: 西藏旅行 · 一起减肥 · 一起读书 · 一起考研 · 一起跑步 — 共享进度、照片、视频与 AI 建议。
        </p>
      </div>

      {shared.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-[14px]" />
          <Skeleton className="h-24 rounded-[14px]" />
        </div>
      ) : shared.data && shared.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {shared.data.map((g) =>
              currentUserId ? (
                <SharedGoalCard key={g.id} goal={g} currentUserId={currentUserId} />
              ) : null,
            )}
          </AnimatePresence>
        </div>
      ) : (
        <EmptyState
          title="还没有共同目标"
          description="发起一个共同目标, 邀请好友一起完成。"
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              发起第一个共同目标
            </Button>
          }
        />
      )}

      {/* AI 团队规划: 仅在已加入共同目标时展示 */}
      {joinedGoals.length > 0 && (
        <section className="space-y-3">
          {joinedGoals.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {joinedGoals.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGoalId(g.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    activeGoalId === g.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  {g.lifeGoalTitle || "共同目标"}
                </button>
              ))}
            </div>
          )}
          {activeGoalId && <AiTeamPlanner sharedGoalId={activeGoalId} />}
        </section>
      )}

      <CreateSharedGoalSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
