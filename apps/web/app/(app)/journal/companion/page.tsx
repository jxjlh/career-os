"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, Send, AlertCircle } from "lucide-react";
import Link from "next/link";

import {
  journalCompanionApi,
  COMPANION_MODES,
  type CompanionMode,
  type CompanionMessage,
} from "@/lib/ai/journal-companion";
import { useI18n } from "@/lib/i18n";
import { easeFast, easeStandard } from "@/lib/motion";

export default function CompanionPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? "";
  const initialMode = (searchParams.get("mode") as CompanionMode) ?? "chat";

  const [mode, setMode] = useState<CompanionMode>(initialMode);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState("");
  const [showModePicker, setShowModePicker] = useState(false);
  const [isHighRisk, setIsHighRisk] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: ({ message }: { message: string }) =>
      journalCompanionApi.chat(sessionId, mode, message, date || undefined),
    onSuccess: (res) => {
      const data = res.data;
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          mode,
        },
      ]);
      if (data.isHighRisk) {
        setShowModePicker(false);
        setIsHighRisk(true);
      }
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: "user",
        content: trimmed,
        mode,
      },
    ]);
    setInput("");
    chatMutation.mutate({ message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = (newMode: CompanionMode) => {
    setMode(newMode);
    setShowModePicker(false);
  };

  const modeInfo = COMPANION_MODES[mode];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* 顶部导航 */}
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="ai-star text-[14px]">✦</span>
            <span className="font-display text-[15px] font-semibold text-text">
              AI 听见
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary">
            {modeInfo.emoji} {modeInfo.label} · {modeInfo.desc}
          </p>
        </div>
        <button
          onClick={() => setShowModePicker(!showModePicker)}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="4" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="12" cy="8" r="1.5" />
          </svg>
        </button>
      </header>

      {/* 模式选择器 */}
      <AnimatePresence>
        {showModePicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-b border-border-subtle"
          >
            <div className="grid grid-cols-2 gap-2 p-4">
              {(Object.keys(COMPANION_MODES) as CompanionMode[]).map((key) => {
                const info = COMPANION_MODES[key];
                const active = mode === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleModeChange(key)}
                    className={`flex items-center gap-2 rounded-[12px] px-3 py-3 text-left transition-all duration-200
                      ${active
                        ? "bg-primary/8 text-text"
                        : "bg-surface text-text-secondary hover:bg-surface-elevated"
                      }
                    `}
                  >
                    <span className="text-lg">{info.emoji}</span>
                    <div>
                      <p className={`text-[13px] font-medium ${active ? "text-text" : "text-text-secondary"}`}>
                        {info.label}
                      </p>
                      <p className="text-[10px] text-text-tertiary">{info.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 初始提示 */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={easeStandard}
              className="flex flex-col items-center text-center pt-8"
            >
              <span className="ai-star text-[20px] mb-3">✦</span>
              <p className="text-[15px] text-text-secondary leading-relaxed max-w-sm">
                {mode === "listen" && "我在听。你继续说。不用组织语言。"}
                {mode === "chat" && "想说什么都可以。不需要写得很好。"}
                {mode === "calm" && "先不解决这件事。我们先让脑子休息一下。"}
                {mode === "reflect" && "我们一起理一理。不着急，慢慢来。"}
              </p>
            </motion.div>
          )}

          {/* 消息 */}
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={easeStandard}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                {msg.role === "assistant" && (
                  <span className="ai-star text-[10px] mb-1 inline-block">✦</span>
                )}
                <div
                  className={`inline-block rounded-[14px] px-4 py-2.5 text-[14px] leading-relaxed
                    ${msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-surface-elevated text-text"
                    }
                  `}
                >
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}

          {/* 加载中 */}
          {chatMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-1.5">
                <span className="ai-star text-[10px]">✦</span>
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-[14px] text-text-tertiary"
                >
                  ...
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* 快捷回应 */}
          {messages.length > 0 && messages[messages.length - 1].role === "assistant" && !isHighRisk && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, ...easeStandard }}
              className="flex justify-start gap-2"
            >
              {mode === "listen" && (
                <>
                  <button onClick={() => { setInput("我想继续说"); }} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    💬 {t("journal.chatWithYou")}
                  </button>
                  <button onClick={() => handleModeChange("calm")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    ☁️ {t("journal.takeBreak")}
                  </button>
                </>
              )}
              {mode === "chat" && (
                <>
                  <button onClick={() => handleModeChange("listen")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    👂 {t("journal.justListen")}
                  </button>
                  <button onClick={() => handleModeChange("reflect")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    🌱 {t("journal.helpReflect")}
                  </button>
                </>
              )}
              {mode === "calm" && (
                <>
                  <button onClick={() => handleModeChange("chat")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    🍃 我好一点了
                  </button>
                  <button onClick={() => handleModeChange("reflect")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    🌱 帮我想明白
                  </button>
                </>
              )}
              {mode === "reflect" && (
                <>
                  <button onClick={() => handleModeChange("chat")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    💬 继续聊聊
                  </button>
                  <button onClick={() => handleModeChange("calm")} className="rounded-full bg-surface-elevated/60 px-3 py-1.5 text-[12px] text-text-secondary hover:bg-surface-elevated">
                    ☁️ 陪我缓一缓
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* 安全模式 */}
          {isHighRisk && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={easeStandard}
              className="mt-6 rounded-[16px] border border-danger/20 bg-danger/5 p-6 text-center"
            >
              <p className="text-[15px] leading-relaxed text-text">
                我很重视你刚刚说的话。
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                如果你现在有伤害自己的打算，请先不要一个人待着。
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
                你可以现在联系一个你信任的人，或者当地的紧急 / 危机支持服务。
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="tel:120"
                  className="inline-flex items-center gap-1.5 rounded-[12px] bg-danger px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:brightness-105"
                >
                  联系身边的人
                </a>
                <a
                  href="https://www.who.int/teams/mental-health-and-substance-use/care/treatment"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-border-subtle bg-surface px-5 py-2.5 text-[13px] font-medium text-text transition-all hover:border-danger/30 hover:bg-surface-elevated"
                >
                  获取紧急帮助
                </a>
              </div>
              <p className="mt-4 text-[11px] text-text-tertiary">
                你不需要一个人面对这些。
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* 底部输入栏 */}
      <div
        className="border-t border-border-subtle px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么……"
            disabled={chatMutation.isPending}
            className="flex-1 rounded-[12px] border border-border-subtle bg-surface px-4 py-2.5 text-[14px] text-text placeholder:text-text-tertiary/60 transition-all focus:border-primary/30 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-white transition-all hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
