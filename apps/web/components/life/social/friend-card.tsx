"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, UserMinus, X } from "lucide-react";

import { Avatar, Button, Chip } from "@/components/life/social/ui-extras";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  type FriendItem,
  type FriendRequestItem,
  type ProfileSearchItem,
} from "@/lib/social";

const queryKeysToInvalidate = [
  ["social-friends"],
  ["social-overview"],
  ["social-requests"],
  ["social-feed"],
  ["social-ranking"],
];

/**
 * 好友列表项卡片: 展示昵称 + 头衔, 可删除好友.
 */
export function FriendCard({ friend }: { friend: FriendItem }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeFriend(friend.profile.id),
    onSuccess: () =>
      queryKeysToInvalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: k })),
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex items-center gap-3 rounded-[12px] border border-border bg-surface p-3"
    >
      <Avatar name={friend.profile.displayName} avatarUrl={friend.profile.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{friend.profile.displayName}</p>
        <p className="truncate text-xs text-muted">
          {friend.profile.currentTitle || "成为好友"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        aria-label="删除好友"
      >
        <UserMinus className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

/**
 * 好友申请卡片: 接受 / 拒绝.
 */
export function FriendRequestCard({ request }: { request: FriendRequestItem }) {
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: () => acceptFriendRequest(request.id),
    onSuccess: () =>
      queryKeysToInvalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: k })),
  });
  const reject = useMutation({
    mutationFn: () => rejectFriendRequest(request.id),
    onSuccess: () =>
      queryKeysToInvalidate.forEach((k) => queryClient.invalidateQueries({ queryKey: k })),
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className="flex items-start gap-3 rounded-[12px] border border-border bg-surface p-3"
    >
      <Avatar name={request.fromUser.displayName} avatarUrl={request.fromUser.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{request.fromUser.displayName}</p>
          <Chip className="bg-primary/10 text-primary">申请</Chip>
        </div>
        {request.message && (
          <p className="mt-1 line-clamp-2 text-xs text-muted">&ldquo;{request.message}&rdquo;</p>
        )}
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending || reject.isPending}>
            <Check className="h-3.5 w-3.5" />
            接受
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reject.mutate()}
            disabled={accept.isPending || reject.isPending}
          >
            <X className="h-3.5 w-3.5" />
            拒绝
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 搜索结果项: 可直接发起好友申请.
 */
export function ProfileSearchCard({
  item,
  onSend,
}: {
  item: ProfileSearchItem;
  onSend: (item: ProfileSearchItem) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 rounded-[12px] border border-border bg-surface p-3"
    >
      <Avatar name={item.displayName} avatarUrl={item.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.displayName}</p>
        <p className="truncate text-xs text-muted">{item.currentTitle || "探索者"}</p>
      </div>
      {item.isFriend ? (
        <Chip className="bg-success/10 text-success">已是好友</Chip>
      ) : (
        <Button
          size="sm"
          variant={item.requestPending ? "outline" : "default"}
          disabled={item.requestPending}
          onClick={() => onSend(item)}
        >
          {item.requestPending ? "已申请" : "加好友"}
        </Button>
      )}
    </motion.div>
  );
}
