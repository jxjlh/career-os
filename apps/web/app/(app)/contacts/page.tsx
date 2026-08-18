"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  QrCode,
} from "lucide-react";

import { AiFriendRecommendation } from "@/components/life/social/ai-friend-recommendation";
import {
  FriendCard,
  FriendRequestCard,
  ProfileSearchCard,
} from "@/components/life/social/friend-card";
import { ShareSheet } from "@/components/life/social/share-sheet";
import { Button, Input, cn } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  chatApi,
  friendApi,
  type Conversation,
  type Message,
} from "@/lib/chat";
import {
  listFriendRequests,
  listFriends,
  searchProfiles,
  sendFriendRequest,
  type ProfileSearchItem,
} from "@/lib/social";

// 好友项
type FriendItem = {
  profile: { id: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
};

// 搜索项
type SearchItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currentTitle: string | null;
  isFriend: boolean;
  requestPending: boolean;
};

export default function ContactsPage() {
  const [tab, setTab] = useState<"chats" | "friends">("chats");
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // 好友页面状态
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

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
    enabled: tab === "chats",
  });

  // 获取好友列表
  const { data: friendsData } = useQuery({
    queryKey: ["social", "friends"],
    queryFn: friendApi.list,
  });

  // 获取好友列表（好友页用）
  const friends = useQuery({ queryKey: ["social-friends"], queryFn: listFriends, enabled: tab === "friends" });
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: listFriendRequests,
    enabled: tab === "friends",
  });
  const profile = useQuery<{ data: { id: string } }>({
    queryKey: ["life-profile"],
    queryFn: () => apiFetch("/profile"),
    enabled: tab === "friends",
  });
  const search = useQuery({
    queryKey: ["social-search", debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: tab === "friends" && debounced.trim().length >= 1,
  });

  // 搜索用户 (聊天用)
  const { data: searchResults } = useQuery({
    queryKey: ["social", "search", searchQuery.trim()],
    queryFn: () => friendApi.search(searchQuery.trim()),
    enabled: tab === "chats" && searchQuery.trim().length >= 1,
  });

  // 获取当前会话的消息
  const { data: messagesData, isLoading: msgLoading } = useQuery({
    queryKey: ["chat", "messages", activeConversation],
    queryFn: () =>
      activeConversation
        ? chatApi.listMessages(activeConversation)
        : Promise.resolve({ data: [], hasMore: false }),
    enabled: tab === "chats" && !!activeConversation,
  });

  const conversations = conversationsData?.data || [];
  const messages = messagesData?.data || [];
  const friendsRaw = (friendsData?.data as FriendItem[]) || [];
  const searchItems = (searchResults?.data as SearchItem[]) || [];

  // 映射好友数据
  const mappedFriends = friendsRaw.map((f) => ({
    id: f.profile?.id,
    displayName: f.profile?.displayName || "用户",
    avatarUrl: f.profile?.avatarUrl,
  }));

  const friendIds = new Set(mappedFriends.map((f) => f.id).filter(Boolean));

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
      queryClient.invalidateQueries({ queryKey: ["chat", "messages", activeConversation] });
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    } catch (err) {
      console.error("发送失败:", err);
      showToast("发送失败，请重试");
    }
  }, [activeConversation, messageInput, queryClient, showToast]);

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

  // 开始私聊
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

  // 发送好友申请
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

  // 好友页面操作
  const send = useMutation({
    mutationFn: (item: ProfileSearchItem) =>
      sendFriendRequest({ toUserId: item.id, message: "一起成长吧!" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-search", debounced] });
      queryClient.invalidateQueries({ queryKey: ["social-requests"] });
    },
  });

  const inviteCode = profile.data?.data?.id?.slice(0, 8).toUpperCase() ?? "LIFEOS";
  const invitePath = `/life/social`;

  const activeConv = conversations.find((c) => c.id === activeConversation);

  return (
    <div className="min-h-screen bg-[#09090B]">
      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-surface-elevated border border-border-subtle rounded-xl px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* 主容器 */}
      <div className="mx-auto max-w-6xl p-4">
        {/* 顶部标题和标签页 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📇</span>
            <div>
              <h1 className="text-xl font-semibold">联系人</h1>
              <p className="text-[13px] text-muted">好友 · 消息 · 一起成长</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("chats")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                tab === "chats"
                  ? "bg-primary/20 text-primary"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              消息
            </button>
            <button
              onClick={() => setTab("friends")}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                tab === "friends"
                  ? "bg-primary/20 text-primary"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              <Users className="h-4 w-4" />
              好友
            </button>
          </div>
        </div>

        {/* 消息标签页 */}
        {tab === "chats" && (
          <div className="flex h-[calc(100vh-200px)] rounded-xl border border-border-subtle bg-surface/30 overflow-hidden">
            {/* 左侧: 会话/好友/搜索 */}
            <div
              className={cn(
                "flex flex-col border-r border-border-subtle bg-surface-muted/30",
                activeConversation ? "hidden md:flex w-80" : "flex w-full md:w-80"
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h2 className="text-lg font-semibold">消息</h2>
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

              <div className="flex-1 overflow-y-auto">
                {/* 搜索结果 */}
                {searchQuery.trim().length >= 1 ? (
                  <div>
                    <div className="p-3 text-xs font-medium uppercase tracking-wider text-muted">
                      搜索结果
                    </div>
                    {searchItems.length === 0 ? (
                      <div className="p-8 text-center text-muted">
                        <p>未找到用户</p>
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
                ) : (
                  <>
                    {/* 会话列表 */}
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

                    {/* 好友列表 */}
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
                )}
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
                <div className="p-4 border-t border-border-subtle bg-surface-muted/20">
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
                    <Button
                      variant="primary"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim()}
                    >
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
                  <p className="text-sm mt-2">或搜索用户发起新的对话</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 好友标签页 */}
        {tab === "friends" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setShareOpen(true)}>
                <QrCode className="h-4 w-4" />
                邀请码
              </Button>
            </div>

            {/* 搜索栏 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="搜索昵称或邮箱…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* 搜索结果 */}
            {debounced.trim() && (
              <section>
                <p className="mb-2 text-xs text-muted">搜索结果</p>
                {search.isLoading && <div className="h-16 rounded-lg bg-surface-muted animate-pulse" />}
                {search.data && search.data.length > 0 ? (
                  <div className="space-y-2">
                    {search.data.map((item) => (
                      <ProfileSearchCard key={item.id} item={item} onSend={(i) => send.mutate(i)} />
                    ))}
                  </div>
                ) : (
                  search.data &&
                  search.data.length === 0 && (
                    <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">
                      没有找到匹配的用户
                    </p>
                  )
                )}
              </section>
            )}

            {/* 好友申请 */}
            {!debounced.trim() && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <UserPlus className="h-3.5 w-3.5" />
                    好友申请
                    {requests.data && requests.data.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-1.5 text-primary">
                        {requests.data.length}
                      </span>
                    )}
                  </p>
                </div>
                {requests.isLoading ? (
                  <div className="h-20 rounded-lg bg-surface-muted animate-pulse" />
                ) : requests.data && requests.data.length > 0 ? (
                  <div className="space-y-2">
                    {requests.data.map((r) => (
                      <FriendRequestCard key={r.id} request={r} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[8px] bg-surface-muted/50 p-3 text-center text-xs text-muted">
                    暂无新的好友申请
                  </p>
                )}
              </section>
            )}

            {/* 好友列表 */}
            {!debounced.trim() && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <Users className="h-3.5 w-3.5" />
                    我的好友
                    {friends.data && (
                      <span className="text-muted">({friends.data.length})</span>
                    )}
                  </p>
                </div>
                {friends.isLoading ? (
                  <div className="space-y-2">
                    <div className="h-16 rounded-lg bg-surface-muted animate-pulse" />
                    <div className="h-16 rounded-lg bg-surface-muted animate-pulse" />
                  </div>
                ) : friends.data && friends.data.length > 0 ? (
                  <div className="space-y-2">
                    {friends.data.map((f) => (
                      <FriendCard key={f.profile.id} friend={f} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted">还没有好友</p>
                    <p className="text-xs text-muted mt-1">搜索昵称或邮箱添加好友，或使用邀请码邀请伙伴。</p>
                    <Button size="sm" onClick={() => setShareOpen(true)} className="mt-3">
                      <QrCode className="h-4 w-4" />
                      生成邀请码
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* AI 推荐 */}
            {!debounced.trim() && search.data && (
              <AiFriendRecommendation friends={search.data} />
            )}
            {!debounced.trim() && !search.data && friends.data && (
              <AiFriendRecommendation friends={[]} />
            )}

            <ShareSheet
              open={shareOpen}
              onClose={() => setShareOpen(false)}
              path={invitePath}
              title="来 AI LifeOS 一起成长"
              description={`我的邀请码: ${inviteCode}`}
              showCopywriting={false}
            />
          </div>
        )}
      </div>

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

// 消息气泡组件
function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
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
}
