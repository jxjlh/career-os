/** 聊天 API 客户端 */

import { apiFetch } from "@/lib/api";

// Types
export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string;
  avatarUrl?: string;
  lastMessageAt?: string;
  lastMessage?: string;
  unread: number;
  otherUserId?: string; // 私聊时的对方 ID
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: {
    id: string;
    displayName?: string;
    avatarUrl?: string;
  };
  type: "text" | "image" | "system";
  content?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  replyToId?: string;
  createdAt: string;
  deleted: boolean;
}

export interface GroupMember {
  id: string;
  displayName?: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

// API functions
export const chatApi = {
  // 会话列表
  listConversations: () =>
    apiFetch<{ data: Conversation[] }>("/chat/conversations"),

  getConversation: (id: string) =>
    apiFetch<{ data: Conversation }>(`/chat/conversations/${id}`),

  // 私聊
  createDirect: (userId: string) =>
    apiFetch<{ data: Conversation }>("/chat/direct", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),

  // 群聊
  createGroup: (name: string, memberIds: string[] = []) =>
    apiFetch<{ data: Conversation }>("/chat/groups", {
      method: "POST",
      body: JSON.stringify({ name, member_ids: memberIds }),
    }),

  addGroupMembers: (conversationId: string, userIds: string[]) =>
    apiFetch<{ data: { added: string[] } }>(
      `/chat/groups/${conversationId}/members`,
      {
        method: "POST",
        body: JSON.stringify({ user_ids: userIds }),
      }
    ),

  removeGroupMember: (conversationId: string, userId: string) =>
    apiFetch<{ data: { ok: boolean } }>(
      `/chat/groups/${conversationId}/members/${userId}`,
      { method: "DELETE" }
    ),

  listGroupMembers: (conversationId: string) =>
    apiFetch<{ data: GroupMember[] }>(
      `/chat/groups/${conversationId}/members`
    ),

  // 消息
  listMessages: (
    conversationId: string,
    before?: string,
    limit = 50
  ) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.append("before", before);
    return apiFetch<{ data: Message[]; hasMore: boolean }>(
      `/chat/conversations/${conversationId}/messages?${params}`
    );
  },

  sendMessage: (
    conversationId: string,
    payload: { content?: string; message_type?: string; image_url?: string; reply_to_id?: string }
  ) =>
    apiFetch<{ data: Message }>(
      `/chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  uploadImage: async (conversationId: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("career_os_token");
    const res = await fetch(
      `/api/v1/chat/conversations/${conversationId}/images`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error(`上传失败: ${res.status}`);
    }

    const data = await res.json() as { data: { url: string } };
    return data.data.url;
  },

  deleteMessage: (messageId: string) =>
    apiFetch<{ data: { ok: boolean } }>(`/chat/messages/${messageId}`, {
      method: "DELETE",
    }),
};

// 好友 API（补充社交模块的聊天入口）
export const friendApi = {
  list: () => apiFetch<{ data: any[] }>("/social/friends"),

  search: (q: string) =>
    apiFetch<{ data: any[] }>(`/social/friends/search?q=${encodeURIComponent(q)}`),

  sendRequest: (toUserId: string, message?: string) =>
    apiFetch<{ data: any }>("/social/friend-requests", {
      method: "POST",
      body: JSON.stringify({ to_user_id: toUserId, message }),
    }),

  listRequests: () =>
    apiFetch<{ data: any[] }>("/social/friend-requests"),

  acceptRequest: (requestId: string) =>
    apiFetch<{ data: any }>(`/social/friend-requests/${requestId}/accept`, {
      method: "POST",
    }),

  rejectRequest: (requestId: string) =>
    apiFetch<{ data: { ok: boolean } }>(
      `/social/friend-requests/${requestId}/reject`,
      { method: "POST" }
    ),

  removeFriend: (friendId: string) =>
    apiFetch<{ data: { ok: boolean } }>(`/social/friends/${friendId}`, {
      method: "DELETE",
    }),
};