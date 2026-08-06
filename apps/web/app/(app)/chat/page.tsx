"use client";

import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  Plus,
  Send,
  Image as ImageIcon,
  Download,
  ArrowLeft,
  Search,
  X,
  UserPlus,
  UserCheck,
  Smile,
} from "lucide-react";
import { chatApi, friendApi, type Conversation, type Message } from "@/lib/chat";
import { apiFetch } from "@/lib/api";
import { Button, Input, cn } from "@/components/ui";
import { EmojiPicker } from "@/components/chat/emoji-picker";

// 好友项 (后端 social/friends 返回结构: { profile: { id, displayName, avatarUrl }, createdAt })
type FriendItem = {
  profile: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
};

// 搜索项 (后端 social/friends/search 返回结构, 已由 CamelModel 转为 camelCase)
type SearchItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currentTitle: string | null;
  isFriend: boolean;
  requestPending: boolean;
};

export default function ChatPage() {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingMessage, setPendingMessage] = useState(false); // 发送中的消息状态
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  // 获取当前用户信息
  const { data: meData } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ data: any }>("/me"),
  });
  const currentUserId = meData?.data?.id;

  // 获取会话列表
  const { data: conversationsData, isLoading: convLoading } = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: chatApi.listConversations,
  });

  // 获取好友列表
  const { data: friendsData } = useQuery({
    queryKey: ["social", "friends"],
    queryFn: friendApi.list,
  });

  // 搜索用户 (输入至少 1 个字符后触发)
  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ["social", "search", searchQuery.trim()],
    queryFn: () => friendApi.search(searchQuery.trim()),
    enabled: searchQuery.trim().length >= 1,
  });

  // 获取当前会话的消息
  const { data: messagesData, isLoading: msgLoading } = useQuery({
    queryKey: ["chat", "messages", activeConversation],
    queryFn: () =>
      activeConversation
        ? chatApi.listMessages(activeConversation)
        : Promise.resolve({ data: [], hasMore: false }),
    enabled: !!activeConversation,
  });

  const conversations = conversationsData?.data || [];
  const messages = messagesData?.data || [];
  const friendsRaw = (friendsData?.data as FriendItem[]) || [];
  const searchItems = (searchResults?.data as SearchItem[]) || [];

  // 映射好友数据: { profile.id, profile.displayName, profile.avatarUrl }
  const mappedFriends = friendsRaw.map((f) => ({
    id: f.profile?.id,
    displayName: f.profile?.displayName || "用户",
    avatarUrl: f.profile?.avatarUrl,
  }));

  // 已在好友关系中的 ID 集合
  const friendIds = new Set(mappedFriends.map((f) => f.id).filter(Boolean));

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 表情选择处理
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  // 发送消息 - 乐观更新优化
  const handleSendMessage = useCallback(async () => {
    if (!activeConversation || !messageInput.trim() || pendingMessage) return;
    
    const content = messageInput.trim();
    setMessageInput("");
    setPendingMessage(true);
    
    try {
      // 立即发送请求（不等待），实现乐观更新
      chatApi.sendMessage(activeConversation, {
        content,
        message_type: "text",
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["chat", "messages", activeConversation] });
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      }).catch((err) => {
        console.error("发送失败:", err);
        showToast("发送失败，请重试");
        // 失败时恢复消息
        setMessageInput(content);
      }).finally(() => {
        setPendingMessage(false);
      });
      
      // 立即刷新会话列表的最后消息显示
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    } catch (err) {
      console.error("发送失败:", err);
      showToast("发送失败，请重试");
      setMessageInput(content);
      setPendingMessage(false);
    }
  }, [activeConversation, messageInput, pendingMessage, queryClient, showToast]);

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
        queryClient.invalidateQueries({ queryKey: ["chat", "messages", activeConversation] });
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      } catch (err) {
        console.error("上传失败:", err);
        showToast("图片上传失败");
      }
    },
    [activeConversation, queryClient, showToast]
  );

  // 创建群聊
  const handleCreateGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;
    try {
      const result = await chatApi.createGroup(newGroupName.trim(), selectedFriends);
      setShowCreateGroup(false);
      setNewGroupName("");
      setSelectedFriends([]);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      setActiveConversation(result.data.id);
    } catch (err) {
      console.error("创建失败:", err);
      showToast("创建群聊失败");
    }
  }, [newGroupName, selectedFriends, queryClient, showToast]);

  // 开始私聊 —— 直接创建会话, 不再要求双方必须是好友
  const handleStartDirect = useCallback(
    async (userId: string) => {
      if (!userId || userId === currentUserId) return;
      try {
        const result = await chatApi.createDirect(userId);
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
        setActiveConversation(result.data.id);
        setSearchQuery("");
      } catch (err) {
        console.error("创建会话失败:", err);
        showToast("无法开启对话，请稍后再试");
      }
    },
    [currentUserId, queryClient, showToast]
  );

  // 发送好友申请 (搜索结果中的非好友)
  const handleSendFriendRequest = useCallback(
    async (toUserId: string) => {
      try {
        await friendApi.sendRequest(toUserId);
        showToast("已发送好友申请");
        queryClient.invalidateQueries({ queryKey: ["social", "search", searchQuery] });
        queryClient.invalidateQueries({ queryKey: ["social", "friends"] });
      } catch (err) {
        console.error("发送好友申请失败:", err);
        showToast("发送失败");
      }
    },
    [queryClient, searchQuery, showToast]
  );

  const activeConv = conversations.find((c) => c.id === activeConversation);

  // 侧边栏内容
  const renderSidebar = () => {
    // 搜索中: 显示搜索结果
    if (searchQuery.trim().length >= 1) {
      return (
        <div>
          <div className="p-3 text-xs font-medium uppercase tracking-wider text-muted">
            搜索结果 {searchLoading ? "· 搜索中..." : ""}
          </div>
          {searchItems.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p>未找到用户</p>
              <p className="text-xs mt-1">检查拼写后重试</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {searchItems.map((u) => {
                const isFriend = u.isFriend || friendIds.has(u.id);
                return (
                  <div
                    key={u.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-elevated/60 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-full bg-surface-muted flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium">
                        {u.displayName?.[0] || "U"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.displayName}</div>
                      {u.currentTitle && (
                        <div className="text-xs text-muted truncate">{u.currentTitle}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartDirect(u.id);
                        }}
                        title="发起聊天"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {isFriend ? (
                        <span className="text-xs text-primary flex items-center gap-1 px-2">
                          <UserCheck className="h-3 w-3" />
                          好友
                        </span>
                      ) : u.requestPending ? (
                        <span className="text-xs text-muted px-2">待接受</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendFriendRequest(u.id);
                          }}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          添加
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 默认: 会话列表 + 好友列表
    return (
      <>
        {convLoading ? (
          <div className="p-8 text-center text-muted">
            <p>加载中...</p>
          </div>
        ) : conversations.length === 0 && mappedFriends.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无会话</p>
            <p className="text-sm mt-1">搜索用户开启对话</p>
          </div>
        ) : (
          conversations.length > 0 && (
            <div className="divide-y divide-border-subtle">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 hover:bg-surface-elevated/60 transition-colors text-left",
                    activeConversation === conv.id && "bg-surface-elevated"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center shrink-0">
                    {conv.type === "group" ? (
                      <Users className="h-5 w-5 text-muted" />
                    ) : (
                      <span className="text-sm font-medium">{conv.name?.[0] || "U"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{conv.name}</span>
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-muted truncate">{conv.lastMessage}</p>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <span className="bg-primary text-white text-xs rounded-full px-2 py-0.5 shrink-0">
                      {conv.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )
        )}

        {mappedFriends.length > 0 && (
          <div className="border-t border-border-subtle">
            <div className="p-3 text-xs font-medium uppercase tracking-wider text-muted">
              好友 ({mappedFriends.length})
            </div>
            <div className="max-h-56 overflow-y-auto">
              {mappedFriends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleStartDirect(f.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-elevated/60 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-surface-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-medium">{f.displayName?.[0] || "U"}</span>
                  </div>
                  <span className="text-sm truncate">{f.displayName}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background relative">
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-surface-elevated border border-border-subtle rounded-xl px-4 py-2 text-sm shadow-lg animate-in fade-in-0">
          {toast}
        </div>
      )}

      {/* 左侧: 会话/好友/搜索 */}
      <div
        className={cn(
          "flex flex-col border-r border-border-subtle bg-surface-muted/30",
          activeConversation ? "hidden md:flex w-80" : "flex w-full md:w-80"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h1 className="text-lg font-semibold">消息</h1>
          <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="p-3 border-b border-border-subtle">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="搜索用户..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{renderSidebar()}</div>
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
            {msgLoading ? (
              <div className="text-center text-muted py-8">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无消息</p>
                <p className="text-sm mt-1">发送第一条消息开始聊天吧</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMine={msg.senderId === currentUserId}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-4 border-t border-border-subtle bg-surface-muted/20 relative">
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="发送图片"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
              
              {/* 表情按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="选择表情"
                className={showEmojiPicker ? "bg-primary/20 text-primary" : ""}
              >
                <Smile className="h-5 w-5" />
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
                disabled={pendingMessage}
              />
              <Button
                variant="primary"
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || pendingMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            {/* 表情选择器 */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-muted">
          <div className="text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>选择一个会话开始聊天</p>
            <p className="text-sm mt-2">或搜索用户发起新的对话</p>
          </div>
        </div>
      )}

      {/* 创建群聊弹窗 */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md mx-4 border border-border-subtle">
            <h2 className="text-lg font-semibold mb-4">创建群聊</h2>
            <Input
              placeholder="群名称"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="mb-4"
              maxLength={30}
            />
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">选择好友</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {mappedFriends.length === 0 ? (
                  <p className="text-sm text-muted">暂无好友，先去添加好友吧</p>
                ) : (
                  mappedFriends.map((f) => (
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
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateGroup(false);
                  setSelectedFriends([]);
                  setNewGroupName("");
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="flex-1"
              >
                创建
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 消息气泡组件 - 使用 memo 优化性能
const MessageBubble = memo(function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const isSystem = message.type === "system";
  const isImage = message.type === "image";

  if (isSystem) {
    return (
      <div className="text-center text-sm text-muted py-2">
        {message.content}
      </div>
    );
  }

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isMine ? "bg-primary text-white" : "bg-surface-elevated"
        )}
      >
        {isImage && message.imageUrl ? (
          <div className="relative group">
            <img
              src={message.imageUrl}
              alt=""
              className="rounded-lg max-w-full"
              style={{ maxHeight: "300px" }}
            />
            <a
              href={message.imageUrl}
              download
              className="absolute bottom-2 right-2 bg-black/50 rounded-lg p-1.5 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
              title="下载图片"
            >
              <Download className="h-4 w-4 text-white" />
            </a>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
});
