"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { Avatar, Button, Skeleton, Textarea } from "@/components/life/social/ui-extras";
import { addComment, listComments, type CommentItem } from "@/lib/social";

interface CommentListProps {
  postId: string;
  initialCount?: number;
}

export function CommentList({ postId, initialCount = 0 }: CommentListProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["social-comments", postId],
    queryFn: () => listComments(postId),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (content: string) => addComment(postId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-post", postId] });
      setDraft("");
    },
  });

  const comments = query.data ?? [];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-text"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="tabular-nums">{initialCount}</span>
        <span>{open ? "收起" : "评论"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="留下鼓励或想法…"
                  rows={2}
                  className="text-[13px]"
                />
                <Button
                  size="icon"
                  onClick={() => draft.trim() && addMutation.mutate(draft.trim())}
                  disabled={!draft.trim() || addMutation.isPending}
                  className="mt-auto"
                  aria-label="发送评论"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {query.isLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              )}

              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}

              {!query.isLoading && comments.length === 0 && (
                <p className="py-2 text-center text-xs text-muted">还没有评论, 来抢沙发 ✨</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentRow({ comment }: { comment: CommentItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2 rounded-[8px] bg-surface-muted/60 p-2"
    >
      <Avatar name={comment.user.displayName} avatarUrl={comment.user.avatarUrl} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">
          <span className="font-medium">{comment.user.displayName}</span>
          <span className="ml-2 text-xs text-muted">{formatRelative(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">{comment.content}</p>
      </div>
    </motion.div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}
