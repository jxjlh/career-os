"use client";

import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";

import { cn } from "@/components/ui";
import type { CoachMessage } from "@/lib/coach";

interface ChatBubbleProps {
  message: CoachMessage;
  index?: number;
}

/**
 * 聊天气泡: 用户右对齐, 教练左对齐.
 * 教练消息支持 Markdown 基础渲染 (标题/列表/加粗/代码块).
 * 进入视口时 Fade + Slide 呈现.
 */
export function ChatBubble({ message, index = 0 }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className={cn("flex items-end gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-gradient-to-br from-violet-500/80 to-indigo-500/60 text-white",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>

      {/* 气泡 */}
      <div
        className={cn(
          "max-w-[78%] whitespace-pre-wrap break-words px-4 py-2.5 text-[14px] leading-relaxed",
          isUser
            ? "rounded-[16px] rounded-br-[4px] bg-primary text-white"
            : "rounded-[16px] rounded-bl-[4px] border border-border bg-surface text-text",
        )}
      >
        {renderContent(message.content)}
      </div>
    </motion.div>
  );
}

/**
 * 极简 Markdown 渲染: 支持代码块 ```...```, 加粗 **...**, 行内代码 `...`.
 * 不引入额外依赖, 满足教练回答的常见格式需求.
 */
function renderContent(content: string) {
  const blocks = content.split(/```/);
  return blocks.map((block, i) => {
    // 奇数索引为代码块
    if (i % 2 === 1) {
      const code = block.replace(/^[a-zA-Z]*\n?/, "").replace(/\n$/, "");
      return (
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-[8px] bg-surface-muted p-3 text-[12px] text-text"
        >
          <code>{code}</code>
        </pre>
      );
    }
    return (
      <span key={i}>
        {renderInline(block)}
      </span>
    );
  });
}

/** 渲染行内加粗与行内代码. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded-[4px] bg-surface-muted px-1 py-0.5 text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
