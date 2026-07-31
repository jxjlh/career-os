"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

import { cn } from "@/components/ui";
import { toggleLike } from "@/lib/social";

interface LikeButtonProps {
  postId: string;
  liked: boolean;
  likesCount: number;
}

/**
 * 点赞按钮: 切换状态时播放 Lottie 风格的弹跳 + 缩放动画.
 * 通过 invalidate feed/post query 触发上层计数刷新.
 */
export function LikeButton({ postId, liked, likesCount }: LikeButtonProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => toggleLike(postId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-post", postId] });
      queryClient.setQueryData<ToggleLikeCached>(["social-like", postId], {
        liked: data.liked,
        likesCount: data.likesCount,
      });
    },
  });

  const isLiked = mutation.data?.liked ?? liked;
  const count = mutation.data?.likesCount ?? likesCount;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!mutation.isPending) mutation.mutate();
      }}
      disabled={mutation.isPending}
      className="group flex items-center gap-1.5 text-[13px] transition-colors"
      aria-label={isLiked ? "取消点赞" : "点赞"}
    >
      <motion.span
        key={isLiked ? "liked" : "unliked"}
        initial={isLiked ? { scale: 0.6 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        whileTap={{ scale: 0.8 }}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-colors",
            isLiked ? "fill-rose-500 text-rose-500" : "text-muted group-hover:text-rose-500",
          )}
        />
      </motion.span>
      <span className={cn("tabular-nums", isLiked ? "text-rose-500" : "text-muted")}>
        {count}
      </span>
    </button>
  );
}

interface ToggleLikeCached {
  liked: boolean;
  likesCount: number;
}
