"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChatBubble } from "@/components/life/coach/chat-bubble";
import { TypingIndicator } from "@/components/life/coach/typing-indicator";
import { Button, Skeleton, Textarea } from "@/components/ui";
import {
  chatWithCoach,
  getConversation,
  type CoachMessage,
} from "@/lib/coach";

/**
 * AI 对话页: 多轮上下文聊天.
 * 支持通过 ?conversation= 续聊历史会话; 空白时新建.
 * 教练回复基于 LifeOS 全量数据, 可引用 Goal/Bucket/Map 等.
 */
export default function CoachChatPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("conversation") ?? null;
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeConv, setActiveConv] = useState<string | null>(conversationId ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // 续聊: 拉取历史消息
  const history = useQuery({
    queryKey: ["coach-conversation", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    if (history.data) {
      setMessages(history.data.messages);
      setActiveConv(history.data.conversation.id);
    }
  }, [history.data]);

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      chatWithCoach({ conversationId: activeConv, message: text }),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, res.message]);
      setActiveConv(res.conversationId);
      // 刷新历史会话列表
      queryClient.invalidateQueries({ queryKey: ["coach-conversations"] });
    },
    onError: () => {
      // 错误提示由 mutation state 处理, 这里不破坏消息流
    },
  });

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sendMutation.isPending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    // 乐观加入用户消息
    const optimistic: CoachMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      toolCalls: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送, Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (conversationId && history.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-9" />
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Link href="/life/coach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium">AI 对话</span>
        </div>
        <div className="w-9" />
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
        {messages.length === 0 && !sendMutation.isPending && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-indigo-500/60 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium">和你的 AI 教练聊聊</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted">
                教练了解你的目标、记录、地图与成就, 试试问:
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "帮我分析今年的成长情况",
                "推荐我下一步的人生目标",
                "下一段旅行去哪比较好?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                  }}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-primary/40 hover:text-text"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatBubble key={msg.id} message={msg} index={idx} />
        ))}

        {sendMutation.isPending && (
          <div className="flex items-end gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/80 to-indigo-500/60 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <TypingIndicator />
          </div>
        )}

        {sendMutation.isError && (
          <div className="rounded-[12px] border border-danger/30 bg-danger/5 p-3 text-center text-[13px] text-danger">
            AI 暂时无法回复, 请稍后重试。
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={() => sendMutation.reset()}
            >
              关闭
            </Button>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border pt-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息, Enter 发送, Shift+Enter 换行"
            rows={1}
            className="max-h-32 min-h-[40px] resize-none"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
