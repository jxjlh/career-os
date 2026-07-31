"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function CoachPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);

  const chats = useQuery<Envelope>({
    queryKey: ["coach-chats"],
    queryFn: () => apiFetch("/coach/chats"),
  });

  const messages = useQuery<Envelope>({
    queryKey: ["coach-messages", chatId],
    queryFn: () => apiFetch(`/coach/chats/${chatId}/messages`),
    enabled: Boolean(chatId),
  });

  const createChat = useMutation({
    mutationFn: () =>
      apiFetch<Envelope>("/coach/chats", {
        method: "POST",
        body: JSON.stringify({ channel: "coach", title: "AI Coach" }),
      }),
    onSuccess: (res) => {
      setChatId(res.data.id);
      queryClient.invalidateQueries({ queryKey: ["coach-chats"] });
    },
  });

  const send = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/coach/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["coach-messages", chatId] });
    },
  });

  const items = messages.data?.data || [];

  return (
    <div>
      <SectionHeader title={t("nav.coach")} subtitle="AI Career Coach" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex min-h-[360px] flex-col justify-end rounded-[6px] bg-surface-muted p-4">
            {items.length === 0 ? (
              <div className="mx-auto max-w-sm text-center">
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-ai" />
                <p className="text-sm font-medium">{t("coach.emptyTitle")}</p>
                <p className="mt-1 text-[13px] text-muted">{t("coach.emptyDesc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((m: any) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-[8px] px-3 py-2 text-[13px] ${
                      m.role === "user" ? "ml-auto bg-primary text-white" : "bg-surface text-text"
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim() && chatId) send.mutate(message.trim());
            }}
          >
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("coach.ask")} />
            <Button type="submit" disabled={!message.trim() || !chatId || send.isPending}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Chats</h2>
          <Button className="mb-3 w-full" onClick={() => createChat.mutate()} disabled={createChat.isPending}>
            {createChat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("coach.newChat")}
          </Button>
          <div className="space-y-2">
            {(chats.data?.data || []).map((c: any) => (
              <button
                key={c.id}
                onClick={() => setChatId(c.id)}
                className={`w-full rounded-[6px] border p-2 text-left text-[13px] ${
                  chatId === c.id ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {c.title}
                <Badge className="mt-1">{c.channel}</Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
