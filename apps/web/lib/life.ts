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

export interface LifeTask {
  id: string;
  goalId?: string | null;
  lifeGoalId?: string | null;
  title: string;
  description?: string | null;
  taskType: string;
  dueDate?: string | null;
  status: string;
  completedAt?: string | null;
  createdAt?: string | null;
}

export async function getLifeGoalTasks(goalId: string): Promise<LifeTask[]> {
  const res = await apiFetch<{ data: LifeTask[] }>(`/life/goals/${goalId}/tasks`);
  return res.data;
}

export async function completeLifeTask(taskId: string): Promise<LifeTask> {
  const res = await apiFetch<{ data: LifeTask }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });
  return res.data;
}

export async function reopenLifeTask(taskId: string): Promise<LifeTask> {
  const res = await apiFetch<{ data: LifeTask }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "todo" }),
  });
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

export interface TravelPlanRequest {
  goalId?: string;
  destination: string;
  days: number;
  budget?: string;
  people?: string;
  interests: string[];
}

export interface TravelDay {
  day: number;
  title: string;
  activities: string[];
}

export interface TravelPlanResponse {
  id: string;
  aiContentId: string;
  title?: string | null;
  summary?: string | null;
  bestTime?: string | null;
  route: TravelDay[];
  preparation: string[];
  tips: string[];
}

export async function generateTravelPlan(payload: TravelPlanRequest): Promise<TravelPlanResponse> {
  return apiFetch<TravelPlanResponse>("/ai/travel-plan", {
    method: "POST",
    body: JSON.stringify({
      goal_id: payload.goalId,
      destination: payload.destination,
      days: payload.days,
      budget: payload.budget,
      people: payload.people,
      interests: payload.interests,
    }),
  });
}

export interface GrowthPhase {
  name: string;
  days: string;
  tasks: string[];
}

export interface GrowthDay {
  day: number;
  tasks: string[];
}

export interface GrowthPlanResponse {
  id: string;
  aiContentId: string;
  title?: string | null;
  summary?: string | null;
  phases: GrowthPhase[];
  dailyPlan: GrowthDay[];
  milestones: string[];
  tips: string[];
}

export interface GenerateTasksResponse {
  createdCount: number;
  taskIds: string[];
}

export async function generateGrowthPlan(payload: {
  goalId?: string;
  targetDescription: string;
  currentStatus?: string;
  availableTime?: string;
  difficulty?: string;
}): Promise<GrowthPlanResponse> {
  return apiFetch<GrowthPlanResponse>("/ai/growth-plan", {
    method: "POST",
    body: JSON.stringify({
      goal_id: payload.goalId,
      target_description: payload.targetDescription,
      current_status: payload.currentStatus,
      available_time: payload.availableTime,
      difficulty: payload.difficulty,
    }),
  });
}

export async function generateGrowthTasks(aiContentId: string): Promise<GenerateTasksResponse> {
  return apiFetch<GenerateTasksResponse>(`/ai/growth-plan/${aiContentId}/generate-tasks`, {
    method: "POST",
  });
}

export interface LifeAssistantResponse {
  greeting?: string | null;
  focusGoal?: { title?: string; progress?: string; reason?: string } | null;
  todayTasks: Array<{ id: string; title: string; priority: string }>;
  progress: { completedTasks: number; totalTasks: number; level: number; xp: number };
  suggestions: string[];
  motivation?: string | null;
  dailySummary?: string | null;
}

export async function getDailyAssistant(): Promise<LifeAssistantResponse> {
  return apiFetch<LifeAssistantResponse>("/ai/assistant/daily");
}

export type YearReviewStyle = "personal" | "social" | "xiaohongshu";

export interface YearReviewRequest {
  year: number;
  style: YearReviewStyle;
}

export interface YearReviewStatistics {
  goalsCompleted?: number;
  tasksCompleted?: number;
  recordsCreated?: number;
  xpGained?: number;
  goals_completed?: number;
  tasks_completed?: number;
  records_created?: number;
  xp_gained?: number;
}

export interface YearReviewResponse {
  id: string;
  aiContentId: string;
  year: number;
  style: YearReviewStyle;
  title?: string | null;
  summary?: string | null;
  statistics: YearReviewStatistics;
  achievements: string[];
  growth: { skills?: string[]; habits?: string[] };
  memories: Array<{ title?: string; description?: string; date?: string | null }>;
  reflection?: string | null;
  nextYearPlan: string[];
}

export async function generateYearReview(
  request: YearReviewRequest,
): Promise<YearReviewResponse> {
  return apiFetch<YearReviewResponse>("/ai/year-review", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
