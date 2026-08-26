/**
 * Chat Page — Server Component layout.
 *
 * Renders metadata and wraps the client-side chat UI.
 * The SSE streaming logic lives in the Client Component below.
 */
import type { Metadata } from "next";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = {
  title: "AI Chat — AI Aggregation App",
  description: "Multi-provider AI chat with streaming responses",
};

export default function ChatPage() {
  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">AI Chat</h1>
          <p className="text-sm text-text-secondary">多引擎聚合对话</p>
        </div>
      </div>
      <ChatClient />
    </main>
  );
}
