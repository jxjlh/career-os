"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LogIn, Users } from "lucide-react";

import { Avatar, Button, Chip } from "@/components/life/social/ui-extras";
import { joinSharedGoal, type SharedGoalItem } from "@/lib/social";

interface SharedGoalCardProps {
  goal: SharedGoalItem;
  currentUserId: string;
}

/**
 * 共同目标卡片: 展示关联人生目标、所有者、成员数, 未加入时可加入.
 */
export function SharedGoalCard({ goal, currentUserId }: SharedGoalCardProps) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinSharedGoal(goal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-shared-goals"] });
      queryClient.invalidateQueries({ queryKey: ["social-overview"] });
    },
  });

  const isOwner = goal.owner.id === currentUserId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-[14px] border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">
            {goal.lifeGoalTitle || "共同目标"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip className="bg-indigo-500/10 text-indigo-500">
              <Users className="h-3 w-3" />
              {goal.membersCount} 人
            </Chip>
            {isOwner && <Chip className="bg-primary/10 text-primary">我发起的</Chip>}
            {goal.joined && !isOwner && <Chip className="bg-success/10 text-success">已加入</Chip>}
          </div>
        </div>
        {!goal.joined && !isOwner && (
          <Button size="sm" onClick={() => join.mutate()} disabled={join.isPending}>
            <LogIn className="h-3.5 w-3.5" />
            加入
          </Button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
        <Avatar name={goal.owner.displayName} avatarUrl={goal.owner.avatarUrl} size={28} />
        <span className="text-xs text-muted">
          由 <span className="font-medium text-text">{goal.owner.displayName}</span> 发起
        </span>
        {goal.shareCode && (
          <span className="ml-auto font-mono text-xs text-muted">
            邀请码: {goal.shareCode}
          </span>
        )}
      </div>
    </motion.div>
  );
}
