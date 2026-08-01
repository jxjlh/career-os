"use client";

import { Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import {
  travelAssistant,
  type TravelAssistantMessage,
  type TravelPlanResponse,
} from "@/lib/life";

const STARTERS = [
  "我想去大理 7 天，预算 5000，喜欢美食和徒步",
  "想去日本看樱花，一家三口，预算 3 万",
  "带爸妈去海边，5 天，节奏慢一点",
];

export function TravelChat({
  goalId,
  onPlanGenerated,
}: {
  goalId?: string;
  onPlanGenerated: (plan: TravelPlanResponse) => void;
}) {
  const [messages, setMessages] = useState<TravelAssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (content: string) => {
    const text = content.trim();
    if (!text || loading) return;
    const nextMessages: TravelAssistantMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const result = await travelAssistant({ goalId, messages: nextMessages });
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
      if (result.title || result.route.length > 0) {
        onPlanGenerated(result);
      }
    } catch {
      setError("AI 暂时没有响应，请稍后重试");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-ai" />
        <h1 className="text-base font-semibold">AI 旅行助手</h1>
      </div>
      <p className="mb-3 text-[13px] text-muted">
        告诉 AI 你的目的地、天数、预算和兴趣，它会一边和你确认需求，一边生成攻略。
      </p>

      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              onClick={() => void send(starter)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-primary/40 hover:text-text"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[85%] rounded-[10px] px-3 py-2 text-[13px] leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-primary text-white"
                : "border border-border bg-surface-muted/70 text-text"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 rounded-[10px] border border-border bg-surface-muted/70 px-3 py-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            AI 正在整理行程...
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="描述你的旅行需求..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          发送
        </Button>
      </form>
    </Card>
  );
}
