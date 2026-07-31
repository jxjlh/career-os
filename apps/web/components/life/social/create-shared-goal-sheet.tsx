"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";
import { useState } from "react";

import { Avatar, Button, Skeleton } from "@/components/life/social/ui-extras";
import { createSharedGoal } from "@/lib/social";
import { getLifeGoals } from "@/lib/life";

interface CreateSharedGoalSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 创建共同目标: 选择已有的人生目标作为底本, 设置可见性, 可选邀请好友.
 */
export function CreateSharedGoalSheet({ open, onClose }: CreateSharedGoalSheetProps) {
  const queryClient = useQueryClient();
  const [lifeGoalId, setLifeGoalId] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);

  const goalsQuery = useQuery({
    queryKey: ["life-goals"],
    queryFn: getLifeGoals,
    enabled: open,
  });

  const friendsQuery = useQuery({
    queryKey: ["social-friends"],
    queryFn: async () => {
      const { listFriends } = await import("@/lib/social");
      return listFriends();
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      createSharedGoal({
        lifeGoalId,
        visibility: "friends",
        inviteUserIds: inviteIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-shared-goals"] });
      queryClient.invalidateQueries({ queryKey: ["social-overview"] });
      setLifeGoalId("");
      setInviteIds([]);
      onClose();
    },
  });

  const goals = goalsQuery.data ?? [];
  const friends = friendsQuery.data ?? [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-[20px] border border-border bg-surface p-5 shadow-xl sm:rounded-[16px]"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">发起共同目标</h3>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mb-2 text-xs text-muted">选择一个人生目标</p>
            {goalsQuery.isLoading ? (
              <Skeleton className="h-10" />
            ) : goals.length === 0 ? (
              <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">
                还没有人生目标, 先去创建一个吧
              </p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setLifeGoalId(g.id)}
                    className={`flex w-full items-center justify-between rounded-[8px] border p-2.5 text-left text-sm transition-colors ${
                      lifeGoalId === g.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="truncate">{g.title}</span>
                    <span className="text-xs text-muted">{g.category}</span>
                  </button>
                ))}
              </div>
            )}

            {friends.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs text-muted">邀请好友 (可选)</p>
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const active = inviteIds.includes(f.profile.id);
                    return (
                      <button
                        key={f.profile.id}
                        type="button"
                        onClick={() =>
                          setInviteIds((prev) =>
                            active
                              ? prev.filter((id) => id !== f.profile.id)
                              : [...prev, f.profile.id],
                          )
                        }
                        className={`flex items-center gap-1.5 rounded-full border p-1 pr-3 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Avatar
                          name={f.profile.displayName}
                          avatarUrl={f.profile.avatarUrl}
                          size={20}
                        />
                        {f.profile.displayName}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <Button
              className="mt-5 w-full"
              onClick={() => create.mutate()}
              disabled={create.isPending || !lifeGoalId}
            >
              <Send className="h-4 w-4" />
              发起共同目标
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
