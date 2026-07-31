import { apiFetch } from "@/lib/api";

/** 人生地图 (Life Map) 类型与数据获取层. 统一 lib 调用, 禁止页面直接 fetch. */

export type MapSourceType = "record" | "goal" | "bucket" | "visit";
export type MapMarkerStatus = "pending" | "in_progress" | "completed" | "achievement";

export interface MapMarker {
  id: string;
  sourceType: MapSourceType;
  sourceId: string;
  title: string;
  subtitle?: string | null;
  coverImage?: string | null;
  latitude: number | null;
  longitude: number | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  visitTime?: string | null;
  createdAt?: string | null;
  photosCount: number;
  videosCount: number;
  status: MapMarkerStatus;
  category?: string | null;
  lifeGoalId?: string | null;
  lifeRecordId?: string | null;
  bucketItemId?: string | null;
  weather?: string | null;
  temperature?: number | null;
}

export interface MapCity {
  city: string;
  country?: string | null;
  latitude: number | null;
  longitude: number | null;
  markerCount: number;
  latestTitle?: string | null;
}

export interface LifeMapData {
  markers: MapMarker[];
  cities: MapCity[];
}

export interface MapStatistics {
  totalMarkers: number;
  totalCities: number;
  totalCountries: number;
  totalDistance: number;
  bucketCompleted: number;
  totalRecords: number;
  totalGoals: number;
  experience: number;
  level: number;
}

export interface MapInsight {
  summary: string;
  highlights: string[];
  nextStop?: {
    title?: string;
    reason?: string;
    category?: string;
  };
  suggestions: string[];
  source: "ai" | "fallback";
}

export interface LifeMapParams {
  year?: number;
  category?: string;
  country?: string;
  city?: string;
}

export async function getLifeMap(params: LifeMapParams = {}): Promise<LifeMapData> {
  const query = new URLSearchParams();
  if (params.year != null) query.set("year", String(params.year));
  if (params.category) query.set("category", params.category);
  if (params.country) query.set("country", params.country);
  if (params.city) query.set("city", params.city);
  const qs = query.toString();
  const res = await apiFetch<{ data: LifeMapData }>(`/life/map${qs ? `?${qs}` : ""}`);
  return res.data;
}

export async function getMapStatistics(): Promise<MapStatistics> {
  const res = await apiFetch<{ data: MapStatistics }>("/life/map/statistics");
  return res.data;
}

export async function getMapMarkerDetail(markerId: string): Promise<Record<string, unknown>> {
  const res = await apiFetch<{ data: Record<string, unknown> }>(`/life/map/${markerId}`);
  return res.data;
}

export async function getMapInsight(): Promise<MapInsight> {
  const res = await apiFetch<{ data: MapInsight }>("/ai/map-insight", { method: "POST" });
  return res.data;
}

/** Marker 状态 -> 颜色 (灰/蓝/绿/金). */
export function markerColor(status: MapMarkerStatus, sourceType: MapSourceType): string {
  if (sourceType === "bucket" && status === "completed") return "#EAB308"; // 金色
  if (sourceType === "goal" && status === "achievement") return "#EAB308"; // 金色
  switch (status) {
    case "completed":
      return "#22C55E"; // 绿色
    case "in_progress":
      return "#3B82F6"; // 蓝色
    case "achievement":
      return "#EAB308"; // 金色
    default:
      return "#9CA3AF"; // 灰色 (pending)
  }
}

/** Marker sourceType -> 图标 emoji. */
export function markerIcon(sourceType: MapSourceType): string {
  switch (sourceType) {
    case "record":
      return "📸";
    case "goal":
      return "🎯";
    case "bucket":
      return "✅";
    case "visit":
      return "📍";
  }
}
