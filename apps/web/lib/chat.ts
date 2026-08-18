/** 聊天 API 客户端 */

import { apiFetch, API_BASE } from "@/lib/api";
import { getAccessToken, isSupabaseConfigured } from "@/lib/supabase";

// 后端基础地址 - 用于转换 /media/ 路径为完整 URL
// 本地开发使用 http://127.0.0.1:8000
// 生产环境: Cloudflare 只代理 /api/*，不代理 /media/*，因此本地路径无法使用
const API_BASE_URL = (() => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace("/api/v1", "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000";
  }
  // 生产环境: /media/ 路径不可用 (Cloudflare 只代理 /api/*)
  // 新上传图片应使用 Supabase 公共 URL (https://...)
  return "";
})();

/**
 * 将媒体路径转换为可访问的完整 URL
 * 后端返回的 /media/xxx 需要转换为完整地址才能访问
 * 注意: 生产环境中 /media/ 路径不可用，必须使用 Supabase 公共 URL
 */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  // 已经是完整 URL (Supabase 公共 URL 等)
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // /media/xxx → 需要加上后端地址 (仅开发环境可用)
  if (path.startsWith("/media/")) {
    return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
  }
  // 其他情况直接返回
  return path;
}

// Types
export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string;
  avatarUrl?: string;
  lastMessageAt?: string;
  lastMessage?: string;
  unread: number;
  otherUserId?: string;
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
  listConversations: () =>
    apiFetch<{ data: Conversation[] }>("/chat/conversations"),

  getConversation: (id: string) =>
    apiFetch<{ data: Conversation }>(`/chat/conversations/${id}`),

  createDirect: (userId: string) =>
    apiFetch<{ data: Conversation }>("/chat/direct", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),

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

    let token: string | null = null;
    if (isSupabaseConfigured) {
      token = await getAccessToken();
    } else if (typeof window !== "undefined") {
      token = localStorage.getItem("career_os_token");
    }

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

// 好友 API
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