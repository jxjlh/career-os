"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Users, Plus, Send, Image as ImageIcon, Download, ArrowLeft } from "lucide-react";
import { chatApi, friendApi, type Conversation, type Message } from "@/lib/chat";
import { Button, Input, cn } from "@/components/ui";

export default function ChatPage() {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // 获取会话列表
  const { data: conversationsData } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: chatApi.listConversations,
  });

  // 获取好友列表
  const { data: friendsData } = useQuery({
    queryKey: ["social", "friends"],
    queryFn: friendApi.list,
  });

  // 获取当前会话的消息
  const { data: messagesData } = useQuery({
    queryKey: ["chat", "messages", activeConversation],
    queryFn: () =>
      activeConversation
        ? chatApi.listMessages(activeConversation)
        : Promise.resolve({ data: [], hasMore: false }),
    enabled: !!activeConversation,
  });

  const conversations = conversationsData?.data || [];
  const messages = messagesData?.data || [];
  const friends = friendsData?.data || [];

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!activeConversation || !messageInput.trim()) return;

    try {
      await chatApi.sendMessage(activeConversation, {
        content: messageInput.trim(),
        message_type: "text",
      });
      setMessageInput("");
      queryClient.invalidateQueries({
        queryKey: ["chat", "messages", activeConversation],
      });
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    } catch (err) {
      console.error("发送失败:", err);
    }
  }, [activeConversation, messageInput, queryClient]);

  // 上传图片
  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!activeConversation) return;

      try {
        const url = await chatApi.uploadImage(activeConversation, file);
        await chatApi.sendMessage(activeConversation, {
          image_url: url,
          message_type: "image",
        });
        queryClient.invalidateQueries({
          queryKey: ["chat", "messages", activeConversation],
        });
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      } catch (err) {
        console.error("上传失败:", err);
      }
    },
    [activeConversation, queryClient]
  );

  // 创建群聊
  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;

    try {
      const result = await chatApi.createGroup(newGroupName, selectedFriends);
      setShowCreateGroup(false);
      setNewGroupName("");
      setSelectedFriends([]);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      setActiveConversation(result.data.id);
    } catch (err) {
      console.error("创建失败:", err);
    }
  }, [newGroupName, selectedFriends, queryClient]);

  // 开始私聊
  const handleStartDirect = useCallback(
    async (userId: string) => {
      try {
        const result = await chatApi.createDirect(userId);
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
        setActiveConversation(result.data.id);
      } catch (err) {
        console.error("创建会话失败:", err);
      }
    },
    [queryClient]
  );

  const activeConv = conversations.find((c) => c.id === activeConversation);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* 左侧: 会话列表 */}
      <div
        className={cn(
          "flex flex-col border-r border-border-subtle",
          activeConversation ? "hidden md:flex w-80" : "flex w-full md:w-80"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h1 className="text-lg font-semibold">消息</h1>
          <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无会话</p>
              <p className="text-sm mt-1">点击好友开始聊天</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 hover:bg-surface-elevated/60 transition-colors",
                    activeConversation === conv.id && "bg-surface-elevated"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center">
                    {conv.type === "group" ? (
                      <Users className="h-5 w-5 text-muted" />
                    ) : (
                      <span className="text-sm font-medium">{conv.name?.[0] || "U"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{conv.name}</span>
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-muted truncate">{conv.lastMessage}</p>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5">
                      {conv.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 好友列表 */}
        <div className="border-t border-border-subtle">
          <div className="p-3 text-xs font-medium uppercase tracking-wider text-muted">
            好友 ({friends.length})
          </div>
          <div className="max-h-48 overflow-y-auto">
            {friends.map((f: any) => (
              <button
                key={f.id}
                onClick={() => handleStartDirect(f.id)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-elevated/60 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-surface-muted flex items-center justify-center">
                  <span className="text-xs font-medium">{f.displayName?.[0] || "U"}</span>
                </div>
                <span className="text-sm">{f.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧: 消息区域 */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div className="flex items-center gap-3 p-4 border-b border-border-subtle">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setActiveConversation(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-8 w-8 rounded-full bg-surface-muted flex items-center justify-center">
              {activeConv?.type === "group" ? (
                <Users className="h-4 w-4 text-muted" />
              ) : (
                <span className="text-xs font-medium">{activeConv?.name?.[0] || "U"}</span>
              )}
            </div>
            <span className="font-medium">{activeConv?.name}</span>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-4 border-t border-border-subtle">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImage(file);
                  e.target.value = "";
                }}
              />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="h-5 w-5" />
              </Button>
              <Input
                placeholder="输入消息..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1"
              />
              <Button variant="primary" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>选择一个会话开始聊天</p>
          </div>
        </div>
      )}

      {/* 创建群聊弹窗 */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">创建群聊</h2>
            <Input
              placeholder="群名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="mb-4"
            />
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">选择好友</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {friends.map((f: any) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(f.id)}
                      onChange={(e) => {
                        setSelectedFriends((prev) =>
                          e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id)
                        );
                      }}
                    />
                    <span>{f.displayName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreateGroup(false)} className="flex-1">
                取消
              </Button>
              <Button variant="primary" onClick={handleCreateGroup} className="flex-1">
                创建
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
  const isSystem = message.type === "system";
  const isImage = message.type === "image";

  if (isSystem) {
    return (
      <div className="text-center text-sm text-muted py-2">
        {message.content}
      </div>
    );
  }

  // 简化判断：暂时假设所有消息都是对方的（需要根据当前用户ID判断）
  const isMine = false;

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isMine ? "bg-primary text-white" : "bg-surface-elevated"
        )}
      >
        {isImage && message.imageUrl ? (
          <div className="relative">
            <img
              src={message.imageUrl}
              alt=""
              className="rounded-lg max-w-full"
              style={{ maxHeight: "300px" }}
            />
            <a
              href={message.imageUrl}
              download
              className="absolute bottom-2 right-2 bg-black/50 rounded-lg p-1.5 hover:bg-black/70 transition-colors"
              title="下载图片"
            >
              <Download className="h-4 w-4 text-white" />
            </a>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        <p className={cn("text-xs mt-1", isMine ? "text-white/70" : "text-muted")}>
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}