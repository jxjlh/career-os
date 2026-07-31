"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button, EmptyState, Skeleton } from "@/components/ui";
import { deleteConversation, listConversations } from "@/lib/coach";

/**
 * 历史会话页: 列出所有 AI 教练对话, 可续聊或删除.
 */
export default function CoachHistoryPage() {
  const queryClient = useQueryClient();
  const conversations = useQuery({
    queryKey: ["coach-conversations"],
    queryFn: listConversations,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["coach-conversations"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Link href="/life/coach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-base font-semibold">历史会话</h1>
        <div className="w-9" />
      </div>

      {conversations.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {conversations.isError && (
        <EmptyState title="加载失败" description="请稍后重试" />
      )}

      {!conversations.isLoading && (conversations.data ?? []).length === 0 && (
        <EmptyState
          title="还没有会话"
          description="开始第一次 AI 对话, 教练会记住你的成长轨迹。"
          action={
            <Link href="/life/coach/chat">
              <Button size="sm">
                <MessageCircle className="h-4 w-4" />
                开始对话
              </Button>
            </Link>
          }
        />
      )}

      <AnimatePresence initial={false}>
        {(conversations.data ?? []).map((conv, idx) => (
          <motion.div
            key={conv.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
            className="group flex items-center gap-3 rounded-[12px] border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <Link href={`/life/coach/chat?conversation=${conv.id}`} className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {conv.title || "未命名会话"}
              </p>
              {conv.summary && (
                <p className="mt-0.5 truncate text-[13px] text-muted">{conv.summary}</p>
              )}
              <p className="mt-1 text-[11px] text-muted">
                {conv.lastMessageAt
                  ? new Date(conv.lastMessageAt).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : new Date(conv.createdAt).toLocaleDateString("zh-CN")}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted hover:text-danger"
              aria-label="删除会话"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(conv.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
