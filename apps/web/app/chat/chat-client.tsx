"use client";

/**
 * ChatClient — Client Component handling SSE streaming.
 *
 * Uses:
 *   - Zustand (chat-store) for multi-turn conversation state
 *   - lib/api/client.ts streamChat() for SSE consumption
 *   - @tanstack/react-query for non-streaming mutations
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { streamChat, type SSEChunk } from "@/lib/api/client";

export function ChatClient() {
  const {
    conversations,
    activeConversationId,
    activeMessages,
    isStreaming,
    error,
    createConversation,
    addMessage,
    appendToMessage,
    updateMessage,
    setStreaming,
    setError,
    clearError,
  } = useChatStore();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConv = useChatStore((s) => s.activeConversation());

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeMessages(), scrollToBottom]);

  // Create initial conversation
  useEffect(() => {
    if (!activeConversationId) {
      createConversation();
    }
  }, [activeConversationId, createConversation]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isStreaming) return;

    clearError();

    // Add user message
    addMessage({ role: "user", content });

    // Add placeholder assistant message (streaming)
    const assistantId = addMessage({
      role: "assistant",
      content: "",
      streaming: true,
    });

    setInput("");
    setStreaming(true);

    // Build message history for the API
    const history = [
      ...activeMessages().filter((m) => !m.streaming),
      { role: "user", content },
    ].map((m) => ({ role: m.role, content: m.content }));

    try {
      await streamChat(
        {
          messages: history,
          provider: useChatStore.getState().currentProvider,
        },
        (chunk: SSEChunk) => {
          if (chunk.content) {
            appendToMessage(assistantId, chunk.content);
          }
          if (chunk.finish_reason === "stop") {
            updateMessage(assistantId, { streaming: false });
          }
        },
        (err: Error) => {
          setError(err.message);
          updateMessage(assistantId, { streaming: false, content: `[Error: ${err.message}]` });
        },
      );
    } finally {
      updateMessage(assistantId, { streaming: false });
      setStreaming(false);
    }
  }, [
    input, isStreaming, addMessage, appendToMessage, updateMessage,
    setStreaming, setError, clearError, activeMessages,
  ]);

  const messages = activeMessages();

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <p>开始一段新对话...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "gradient-primary text-white"
                      : "bg-surface-elevated text-text"
                  }`}
                >
                  {msg.content || (msg.streaming ? "..." : "")}
                  {msg.streaming && (
                    <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-current align-middle" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-text outline-none transition-colors focus:border-primary"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl gradient-primary px-6 py-3 font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStreaming ? "生成中..." : "发送"}
        </button>
      </form>
    </div>
  );
}
