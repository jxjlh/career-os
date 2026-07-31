import { apiFetch } from "@/lib/api";

// ── 共享类型 ──────────────────────────────────────────────────────
export interface ProfileSummary {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  currentTitle?: string | null;
}

export type PostVisibility = "public" | "friends" | "private" | "link";

export type RankingMetric =
  | "xp"
  | "streak"
  | "bucket"
  | "goals"
  | "cities"
  | "countries"
  | "achievements";

export type RankingPeriod = "today" | "week" | "month" | "all";

// ── 概览 ──────────────────────────────────────────────────────────
export interface FriendRecentCompletion {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  title: string;
  category?: string | null;
  completedAt?: string | null;
}

export interface SocialOverview {
  friendsCount: number;
  pendingRequests: number;
  sharedGoalsCount: number;
  todayGrowth: number;
  checkinStreak: number;
  friendsRecentCompletions: FriendRecentCompletion[];
}

export async function getSocialOverview(): Promise<SocialOverview> {
  const res = await apiFetch<{ data: SocialOverview }>("/social/overview");
  return res.data;
}

// ── 好友 ──────────────────────────────────────────────────────────
export interface FriendItem {
  profile: ProfileSummary;
  createdAt: string;
}

export async function listFriends(): Promise<FriendItem[]> {
  const res = await apiFetch<{ data: FriendItem[] }>("/social/friends");
  return res.data;
}

export interface ProfileSearchItem {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  currentTitle?: string | null;
  isFriend: boolean;
  requestPending: boolean;
}

export async function searchProfiles(q: string): Promise<ProfileSearchItem[]> {
  const res = await apiFetch<{ data: ProfileSearchItem[] }>(
    `/social/friends/search?q=${encodeURIComponent(q)}`,
  );
  return res.data;
}

export interface FriendRequestItem {
  id: string;
  fromUser: ProfileSummary;
  message?: string | null;
  status: string;
  createdAt: string;
}

export async function listFriendRequests(): Promise<FriendRequestItem[]> {
  const res = await apiFetch<{ data: FriendRequestItem[] }>("/social/friend-requests");
  return res.data;
}

export async function sendFriendRequest(payload: {
  toUserId?: string;
  email?: string;
  message?: string;
}): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ data: { ok: boolean } }>("/social/friend-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function acceptFriendRequest(requestId: string): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ data: { ok: boolean } }>(
    `/social/friend-requests/${requestId}/accept`,
    { method: "POST" },
  );
  return res.data;
}

export async function rejectFriendRequest(requestId: string): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ data: { ok: boolean } }>(
    `/social/friend-requests/${requestId}/reject`,
    { method: "POST" },
  );
  return res.data;
}

export async function removeFriend(friendId: string): Promise<{ ok: boolean }> {
  const res = await apiFetch<{ data: { ok: boolean } }>(`/social/friends/${friendId}`, {
    method: "DELETE",
  });
  return res.data;
}

// ── 动态 Feed ─────────────────────────────────────────────────────
export interface SocialPost {
  id: string;
  user: ProfileSummary;
  content?: string | null;
  photos: string[];
  videos: string[];
  visibility: PostVisibility;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  lifeRecordId?: string | null;
  bucketItemId?: string | null;
  createdAt: string;
}

export async function getFeed(offset = 0, limit = 20): Promise<SocialPost[]> {
  const res = await apiFetch<{ data: SocialPost[] }>(
    `/social/feed?offset=${offset}&limit=${limit}`,
  );
  return res.data;
}

export async function getPost(postId: string): Promise<SocialPost> {
  const res = await apiFetch<{ data: SocialPost }>(`/social/posts/${postId}`);
  return res.data;
}

export interface CreatePostPayload {
  content?: string | null;
  photos?: string[];
  videos?: string[];
  visibility?: PostVisibility;
  lifeRecordId?: string | null;
  bucketItemId?: string | null;
}

export async function createPost(payload: CreatePostPayload): Promise<SocialPost> {
  const res = await apiFetch<{ data: SocialPost }>("/social/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export interface ToggleLikeResult {
  liked: boolean;
  likesCount: number;
}

export async function toggleLike(postId: string): Promise<ToggleLikeResult> {
  const res = await apiFetch<{ data: ToggleLikeResult }>(`/social/posts/${postId}/like`, {
    method: "POST",
  });
  return res.data;
}

export interface CommentItem {
  id: string;
  user: ProfileSummary;
  content: string;
  createdAt: string;
}

export async function listComments(postId: string): Promise<CommentItem[]> {
  const res = await apiFetch<{ data: CommentItem[] }>(`/social/posts/${postId}/comments`);
  return res.data;
}

export async function addComment(postId: string, content: string): Promise<CommentItem> {
  const res = await apiFetch<{ data: CommentItem }>(`/social/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return res.data;
}

// ── 共同目标 ──────────────────────────────────────────────────────
export interface SharedGoalItem {
  id: string;
  lifeGoalId: string;
  lifeGoalTitle?: string | null;
  owner: ProfileSummary;
  visibility: PostVisibility;
  shareCode?: string | null;
  membersCount: number;
  joined: boolean;
  createdAt: string;
}

export async function listSharedGoals(): Promise<SharedGoalItem[]> {
  const res = await apiFetch<{ data: SharedGoalItem[] }>("/social/shared-goals");
  return res.data;
}

export async function createSharedGoal(payload: {
  lifeGoalId: string;
  visibility?: PostVisibility;
  inviteUserIds?: string[];
}): Promise<SharedGoalItem> {
  const res = await apiFetch<{ data: SharedGoalItem }>("/social/shared-goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function joinSharedGoal(sharedId: string): Promise<SharedGoalItem> {
  const res = await apiFetch<{ data: SharedGoalItem }>(`/social/shared-goals/${sharedId}/join`, {
    method: "POST",
  });
  return res.data;
}

export interface SharedGoalMember {
  profile: ProfileSummary;
  role: string;
  joinedAt: string;
}

export async function listSharedMembers(sharedId: string): Promise<SharedGoalMember[]> {
  const res = await apiFetch<{ data: SharedGoalMember[] }>(
    `/social/shared-goals/${sharedId}/members`,
  );
  return res.data;
}

// ── 排行榜 ────────────────────────────────────────────────────────
export interface RankingItem {
  user: ProfileSummary;
  rank: number;
  value: number;
  metric: string;
  extra?: Record<string, unknown> | null;
}

export interface RankingResponse {
  metric: string;
  period: string;
  items: RankingItem[];
}

export async function getRanking(
  metric: RankingMetric = "xp",
  period: RankingPeriod = "all",
): Promise<RankingResponse> {
  const res = await apiFetch<{ data: RankingResponse }>(
    `/social/ranking?metric=${metric}&period=${period}`,
  );
  return res.data;
}

// ── AI 好友推荐 ───────────────────────────────────────────────────
export interface FriendRecommendationRequest {
  interests?: string[];
  growthDirection?: string;
  city?: string;
  goalTitle?: string;
  bucketTitles?: string[];
}

export interface FriendRecommendationItem {
  friendId: string;
  reason: string;
  confidence: number;
}

export interface SharedGoalSuggestion {
  title: string;
  category: string;
  description: string;
}

export interface FriendRecommendationResponse {
  recommendations: FriendRecommendationItem[];
  sharedGoalSuggestions: SharedGoalSuggestion[];
  source: string;
}

export async function recommendFriends(
  payload: FriendRecommendationRequest,
): Promise<FriendRecommendationResponse> {
  return apiFetch<FriendRecommendationResponse>("/ai/friend-recommendation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── AI 团队规划 ───────────────────────────────────────────────────
export interface TeamPlanRequest {
  sharedGoalId: string;
}

export interface TeamTaskItem {
  title: string;
  assignee: string;
  estimatedDays: number;
  startAt?: string | null;
}

export interface TeamMilestone {
  milestone: string;
  targetDate?: string | null;
}

export interface TeamRiskItem {
  risk: string;
  mitigation: string;
}

export interface TeamPlanResponse {
  tasks: TeamTaskItem[];
  timeline: TeamMilestone[];
  risks: TeamRiskItem[];
  collaborationTip?: string | null;
  source: string;
}

export async function generateTeamPlan(payload: TeamPlanRequest): Promise<TeamPlanResponse> {
  return apiFetch<TeamPlanResponse>("/ai/team-plan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── 排行榜指标元信息 ──────────────────────────────────────────────
export const RANKING_METRICS: Array<{
  metric: RankingMetric;
  label: string;
  unit: string;
  icon: string;
}> = [
  { metric: "xp", label: "经验值", unit: "XP", icon: "⚡" },
  { metric: "streak", label: "连续打卡", unit: "天", icon: "🔥" },
  { metric: "bucket", label: "必做清单", unit: "项", icon: "✅" },
  { metric: "goals", label: "人生目标", unit: "个", icon: "🎯" },
  { metric: "cities", label: "城市数量", unit: "城", icon: "🏙️" },
  { metric: "countries", label: "国家数量", unit: "国", icon: "🌍" },
  { metric: "achievements", label: "成就", unit: "枚", icon: "🏆" },
];

export const RANKING_PERIODS: Array<{ period: RankingPeriod; label: string }> = [
  { period: "today", label: "今日" },
  { period: "week", label: "本周" },
  { period: "month", label: "本月" },
  { period: "all", label: "全部" },
];

export const VISIBILITY_LABELS: Record<PostVisibility, string> = {
  public: "公开",
  friends: "好友可见",
  private: "仅自己",
  link: "链接分享",
};
