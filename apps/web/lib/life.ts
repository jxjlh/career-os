import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export interface LifeGoal {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  goalType: string;
  difficulty: number;
  targetDate?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string | null;
  status: string;
  isAiGenerated: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CategoryStat {
  total: number;
  completed: number;
}

export interface LifeDashboard {
  totalGoals: number;
  completedGoals: number;
  completionRate: number;
  experience: number;
  level: number;
  categoryStats: Record<string, CategoryStat>;
  recentCompleted: LifeGoal[];
}

export async function getLifeDashboard(): Promise<LifeDashboard> {
  const res = await apiFetch<{ data: LifeDashboard }>("/life/dashboard");
  return res.data;
}

export function getLevelInfo(level: number, experience: number) {
  const currentFloor = (level - 1) ** 2 * 100;
  const nextFloor = level ** 2 * 100;
  const progressPercent = Math.min(100, Math.round(((experience - currentFloor) / (nextFloor - currentFloor)) * 100));
  const remaining = Math.max(0, nextFloor - experience);
  return { currentFloor, nextFloor, progressPercent, remaining };
}

export const CATEGORY_META: Record<
  string,
  { icon: string; labelZh: string; labelEn: string; gradient: string }
> = {
  travel: { icon: "🌍", labelZh: "世界探索", labelEn: "World", gradient: "from-sky-400/15 to-blue-500/10" },
  career: { icon: "💼", labelZh: "职业突破", labelEn: "Career", gradient: "from-amber-400/15 to-orange-500/10" },
  skill: { icon: "🚀", labelZh: "技能成长", labelEn: "Skills", gradient: "from-emerald-400/15 to-teal-500/10" },
  health: { icon: "💪", labelZh: "健康生活", labelEn: "Health", gradient: "from-rose-400/15 to-pink-500/10" },
  relationship: {
    icon: "❤️",
    labelZh: "情感关系",
    labelEn: "Relationships",
    gradient: "from-fuchsia-400/15 to-purple-500/10",
  },
  finance: { icon: "💰", labelZh: "财富人生", labelEn: "Finance", gradient: "from-yellow-400/15 to-lime-500/10" },
  other: { icon: "✨", labelZh: "其他目标", labelEn: "Other", gradient: "from-slate-400/15 to-slate-500/10" },
};

export interface LifeRecord {
  id: string;
  goalId: string;
  recordType: string;
  photoUrl?: string | null;
  watermarkUrl?: string | null;
  content?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
  weather?: string | null;
  altitude?: number | null;
  goalTitle?: string | null;
  deviceInfo?: Record<string, string>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LifeRecordListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: LifeRecord[];
}

export async function createLifeRecord(
  goalId: string,
  payload: {
    file: File;
    content?: string;
    latitude?: number | null;
    longitude?: number | null;
    city?: string;
    country?: string;
  },
): Promise<{ id: string; goalId: string; status: string }> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("record_type", "photo");
  if (payload.content) form.append("content", payload.content);
  if (payload.latitude != null) form.append("latitude", String(payload.latitude));
  if (payload.longitude != null) form.append("longitude", String(payload.longitude));
  if (payload.city) form.append("city", payload.city);
  if (payload.country) form.append("country", payload.country);
  const res = await apiFetch<{ data: { id: string; goalId: string; status: string } }>(
    `/life/goals/${goalId}/records`,
    { method: "POST", body: form },
  );
  return res.data;
}

export async function getGoalRecords(goalId: string): Promise<LifeRecord[]> {
  const res = await apiFetch<{ data: LifeRecord[] }>(`/life/goals/${goalId}/records`);
  return res.data;
}

export async function getLifeRecords(
  page = 1,
  pageSize = 20,
  goalId?: string,
): Promise<LifeRecordListResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (goalId) query.set("goal_id", goalId);
  const res = await apiFetch<{ data: LifeRecordListResponse }>(`/life/records?${query.toString()}`);
  return res.data;
}

export async function getLifeRecordDetail(id: string): Promise<LifeRecord> {
  const res = await apiFetch<{ data: LifeRecord }>(`/life/records/${id}`);
  return res.data;
}

export async function getRecordMediaUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from("life-records").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
