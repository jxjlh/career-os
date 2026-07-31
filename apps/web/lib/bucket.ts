import { apiFetch } from "@/lib/api";

/** Bucket List 类型与数据获取层. 页面禁止直接 fetch, 统一走此模块. */

export interface BucketCategory {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  coverImage?: string | null;
  sort: number;
  itemCount: number;
}

export interface UserBucketState {
  joined: boolean;
  wishlist: boolean;
  favorite: boolean;
  completed: boolean;
  lifeGoalId?: string | null;
  joinedAt?: string | null;
  completedAt?: string | null;
}

export interface BucketItem {
  id: string;
  categoryId: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  story?: string | null;
  coverImage?: string | null;
  galleryImages: string[];
  videoUrl?: string | null;
  difficulty: number;
  estimatedCost?: string | null;
  estimatedDays?: number | null;
  bestSeason?: string | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  tags: string[];
  tips?: string | null;
  popularity: number;
  completedCount: number;
  status: string;
  createdAt?: string | null;
  userState?: UserBucketState | null;
}

export interface BucketItemListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: BucketItem[];
}

export interface BucketProgress {
  completedCount: number;
  joinedCount: number;
  totalCatalog: number;
  aspirationalTotal: number;
  experience: number;
  level: number;
  streak: number;
}

export interface BucketRecommendationItem {
  itemId: string;
  title: string;
  coverImage?: string | null;
  reason: string;
  matchScore: number;
  priority: string;
  category?: string | null;
}

export interface BucketRecommendationResponse {
  recommendations: BucketRecommendationItem[];
  source: "ai" | "fallback";
}

export type BucketSort = "popular" | "latest" | "recommended" | "nearest";

export interface BucketListParams {
  q?: string;
  categoryId?: string;
  country?: string;
  city?: string;
  tag?: string;
  difficulty?: number;
  season?: string;
  completed?: boolean;
  sort?: BucketSort;
  lat?: number;
  lng?: number;
  page?: number;
  pageSize?: number;
}

export async function getBucketCategories(): Promise<BucketCategory[]> {
  const res = await apiFetch<{ data: BucketCategory[] }>("/life/bucket/categories");
  return res.data;
}

export async function getBucketProgress(): Promise<BucketProgress> {
  const res = await apiFetch<{ data: BucketProgress }>("/life/bucket/progress");
  return res.data;
}

export async function getBucketItems(params: BucketListParams = {}): Promise<BucketItemListResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.categoryId) query.set("category_id", params.categoryId);
  if (params.country) query.set("country", params.country);
  if (params.city) query.set("city", params.city);
  if (params.tag) query.set("tag", params.tag);
  if (params.difficulty != null) query.set("difficulty", String(params.difficulty));
  if (params.season) query.set("season", params.season);
  if (params.completed != null) query.set("completed", String(params.completed));
  if (params.sort) query.set("sort", params.sort);
  if (params.lat != null) query.set("lat", String(params.lat));
  if (params.lng != null) query.set("lng", String(params.lng));
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 20));
  const res = await apiFetch<{ data: BucketItemListResponse }>(`/life/bucket/items?${query.toString()}`);
  return res.data;
}

export async function getBucketItem(id: string): Promise<BucketItem> {
  const res = await apiFetch<{ data: BucketItem }>(`/life/bucket/items/${id}`);
  return res.data;
}

export async function joinBucketItem(id: string): Promise<{ lifeGoalId: string; bucketItemId: string }> {
  const res = await apiFetch<{ data: { lifeGoalId: string; bucketItemId: string } }>(
    `/life/bucket/items/${id}/join`,
    { method: "POST" },
  );
  return res.data;
}

export async function unjoinBucketItem(id: string): Promise<void> {
  await apiFetch(`/life/bucket/items/${id}/join`, { method: "DELETE" });
}

export async function toggleBucketFavorite(id: string): Promise<UserBucketState> {
  const res = await apiFetch<{ data: UserBucketState }>(`/life/bucket/items/${id}/favorite`, {
    method: "POST",
  });
  return res.data;
}

export async function toggleBucketWishlist(id: string): Promise<UserBucketState> {
  const res = await apiFetch<{ data: UserBucketState }>(`/life/bucket/items/${id}/wishlist`, {
    method: "POST",
  });
  return res.data;
}

export async function completeBucketItem(id: string): Promise<UserBucketState> {
  const res = await apiFetch<{ data: UserBucketState }>(`/life/bucket/items/${id}/complete`, {
    method: "POST",
  });
  return res.data;
}

export interface BucketRecommendationRequest {
  career?: string;
  interests?: string[];
  budget?: string;
  city?: string;
  time?: string;
  growthDirection?: string;
}

export async function recommendBucketItems(
  payload: BucketRecommendationRequest,
): Promise<BucketRecommendationResponse> {
  const res = await apiFetch<BucketRecommendationResponse>("/ai/bucket-recommendation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res;
}

/** 难度 1~5 映射到星级文案. */
export function difficultyLabel(d: number): string {
  return "★".repeat(Math.max(1, Math.min(5, d)));
}

/** Bucket 分类 -> 主色调, 用于卡片配色. */
export function categoryColor(name?: string | null): string {
  if (!name) return "#A855F7";
  const map: Record<string, string> = {
    旅行: "#3B82F6",
    成长: "#10B981",
    学习: "#8B5CF6",
    摄影: "#F59E0B",
    挑战: "#EF4444",
    爱情: "#EC4899",
    家庭: "#14B8A6",
    事业: "#6366F1",
    财富: "#EAB308",
    公益: "#22C55E",
    运动: "#F97316",
    体验: "#A855F7",
  };
  return map[name] ?? "#A855F7";
}
