import { apiFetch } from "@/lib/api";

// 媒体文件（图片/视频）直接从 Render 后端加载，跨域 img/video 标签无需 CORS
// 生产环境 API_BASE 是 /api/v1（同源代理），媒体不能走代理（二进制性能差）
// 所以媒体固定走 Render 绝对 URL
const BACKEND_ORIGIN = "https://ai-life-os-api-4y3x.onrender.com";
const MEDIA_ORIGIN = BACKEND_ORIGIN;

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
  budget?: string | null;
  recommendedDays?: number | null;
  bestSeason?: string | null;
  region?: string | null;
  friends?: string[];
  aiPlanMeta?: Record<string, unknown>;
  status: string;
  isAiGenerated: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LifeGoalInput {
  title: string;
  category: string;
  description?: string;
  difficulty?: number;
  targetDate?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  budget?: string;
  recommendedDays?: number;
  bestSeason?: string;
  region?: string;
  friends?: string[];
  status?: string;
}

export async function createLifeGoal(payload: LifeGoalInput): Promise<LifeGoal> {
  const res = await apiFetch<{ data: LifeGoal }>("/life/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateLifeGoal(
  goalId: string,
  payload: Partial<LifeGoalInput>,
): Promise<LifeGoal> {
  const res = await apiFetch<{ data: LifeGoal }>(`/life/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
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

export async function getLifeGoals(): Promise<LifeGoal[]> {
  const res = await apiFetch<{ data: LifeGoal[] }>("/life/goals");
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

export function getCategoryMeta(category?: string | null) {
  const key = category || "other";
  return (
    CATEGORY_META[key] ?? {
      icon: "✨",
      labelZh: category || "其他目标",
      labelEn: "Custom",
      gradient: "from-slate-400/15 to-slate-500/10",
    }
  );
}

export interface LifeRecord {
  id: string;
  goalId: string;
  recordType: string;
  photoUrl?: string | null;
  watermarkUrl?: string | null;
  // Sprint 7: 视频日志 + AI 场景识别字段
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  sceneType?: string | null;
  aiTags?: string[];
  aiDescription?: string | null;
  temperature?: number | null;
  bucketItemId?: string | null;
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
    weather?: string;
    altitude?: number | null;
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
  if (payload.weather) form.append("weather", payload.weather);
  if (payload.altitude != null) form.append("altitude", String(payload.altitude));
  const res = await apiFetch<{ data: { id: string; goalId: string; status: string } }>(
    `/life/goals/${goalId}/records`,
    { method: "POST", body: form },
  );
  return res.data;
}

// ── Sprint 7 Life Camera: 视频日志 + AI 场景记录 ────────────────────
export interface CreateVideoRecordPayload {
  video: File;
  thumbnail?: File | null;
  content?: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  country?: string;
  weather?: string;
  altitude?: number | null;
  durationSeconds?: number;
  sceneType?: string;
  aiTags?: string[];
  temperature?: number | null;
  bucketItemId?: string;
}

export async function createVideoRecord(
  goalId: string,
  payload: CreateVideoRecordPayload,
): Promise<{ id: string; goalId: string; status: string }> {
  const form = new FormData();
  form.append("video", payload.video);
  form.append("record_type", "video");
  if (payload.thumbnail) form.append("thumbnail", payload.thumbnail);
  if (payload.content) form.append("content", payload.content);
  if (payload.latitude != null) form.append("latitude", String(payload.latitude));
  if (payload.longitude != null) form.append("longitude", String(payload.longitude));
  if (payload.city) form.append("city", payload.city);
  if (payload.country) form.append("country", payload.country);
  if (payload.weather) form.append("weather", payload.weather);
  if (payload.altitude != null) form.append("altitude", String(payload.altitude));
  if (payload.durationSeconds != null) form.append("duration_seconds", String(payload.durationSeconds));
  if (payload.sceneType) form.append("scene_type", payload.sceneType);
  if (payload.aiTags?.length) form.append("ai_tags", JSON.stringify(payload.aiTags));
  if (payload.temperature != null) form.append("temperature", String(payload.temperature));
  if (payload.bucketItemId) form.append("bucket_item_id", payload.bucketItemId);
  const res = await apiFetch<{ data: { id: string; goalId: string; status: string } }>(
    `/life/goals/${goalId}/records`,
    { method: "POST", body: form },
  );
  return res.data;
}

// ── Sprint 7 Life Camera: 连续打卡 ─────────────────────────────────
export interface CheckinStreak {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate?: string | null;
  totalCheckins: number;
  checkedInToday: boolean;
}

export async function getCheckinStreak(): Promise<CheckinStreak> {
  const res = await apiFetch<{ data: CheckinStreak }>("/life/checkin");
  return res.data;
}

export async function triggerCheckin(): Promise<CheckinStreak> {
  const res = await apiFetch<{ data: CheckinStreak }>("/life/checkin", { method: "POST" });
  return res.data;
}

// ── Sprint 7 Life Camera: AI 场景识别 + AI 日志 ─────────────────────
export interface PhotoAnalysisRequest {
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  country?: string;
  weather?: string;
  temperature?: number | null;
  altitude?: number | null;
  capturedAt?: string;
  photoDescription?: string;
  goalId?: string;
}

export interface RelatedBucketItem {
  bucketId: string;
  title?: string | null;
  reason: string;
}

export interface RelatedGoalItem {
  goalId: string;
  title?: string | null;
  reason: string;
}

export interface SuggestedRecord {
  type: string;
  content: string;
}

export interface PhotoAnalysisResponse {
  sceneType?: string | null;
  tags: string[];
  description?: string | null;
  relatedBuckets: RelatedBucketItem[];
  relatedGoals: RelatedGoalItem[];
  suggestedRecord?: SuggestedRecord | null;
  source: string;
}

export async function analyzePhoto(payload: PhotoAnalysisRequest): Promise<PhotoAnalysisResponse> {
  return apiFetch<PhotoAnalysisResponse>("/ai/photo-analysis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface JournalRequest {
  mediaType: "photo" | "video";
  mediaDescription?: string;
  city?: string;
  country?: string;
  weather?: string;
  temperature?: number | null;
  altitude?: number | null;
  capturedAt?: string;
  goalId?: string;
  goalTitle?: string;
}

export interface JournalResponse {
  title?: string | null;
  body?: string | null;
  reflection?: string | null;
  keywords: string[];
  source: string;
}

export async function generateJournal(payload: JournalRequest): Promise<JournalResponse> {
  return apiFetch<JournalResponse>("/ai/journal", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  if (!path) return null;
  // 绝对 URL 直接返回
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // /media/ 相对路径 —— 静态导出后没有 rewrites，拼接后端 origin
  if (path.startsWith("/media/")) {
    return `${MEDIA_ORIGIN}${path}`;
  }

  // 后端负责校验归属并签名 Supabase 对象或回退到本地 /media.
  try {
    const res = await apiFetch<{ data: { url: string } }>(
      `/life/records/media?path=${encodeURIComponent(path)}`,
    );
    const url = res.data.url;
    if (url) {
      // 后端可能返回 /media/... 相对路径，拼接后端 origin
      if (url.startsWith("/media/")) {
        return `${MEDIA_ORIGIN}${url}`;
      }
      return url;
    }
    console.warn("getRecordMediaUrl: empty url from API", { path });
    return null;
  } catch (err) {
    console.warn("getRecordMediaUrl: failed", { path, error: err });
    return null;
  }
}

/** 生成目标建议卡片可直接创建的输入. */
export interface GoalSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  suggested: {
    location?: string;
    budget?: string;
    recommendedDays?: number;
    bestSeason?: string;
    region?: string;
  };
}

export async function getGoalSuggestions(): Promise<GoalSuggestion[]> {
  const res = await apiFetch<{ data: GoalSuggestion[] }>("/life/goal-suggestions");
  return res.data;
}

export interface LifeMapSummary {
  totalRecords: number;
  totalCities: number;
  totalCountries: number;
  totalDestinations: number;
}

export interface LifeMapCity {
  city: string;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  recordCount: number;
  latestRecordId: string | null;
  latestContent: string | null;
}

export interface LifeMapData {
  summary: LifeMapSummary;
  cities: LifeMapCity[];
  records: LifeRecord[];
  destinations: LifeGoal[];
}

export async function getLifeMap(): Promise<LifeMapData> {
  const res = await apiFetch<{ data: LifeMapData }>("/life/map");
  return res.data;
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

export interface TravelAssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TravelAssistantResponse extends TravelPlanResponse {
  reply: string;
}

export async function travelAssistant(payload: {
  goalId?: string;
  messages: TravelAssistantMessage[];
}): Promise<TravelAssistantResponse> {
  return apiFetch<TravelAssistantResponse>("/ai/travel-assistant", {
    method: "POST",
    body: JSON.stringify({
      goalId: payload.goalId,
      messages: payload.messages,
    }),
  });
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

export interface TravelChecklistItem {
  id: string;
  aiContentId: string;
  item: string;
  note?: string | null;
  checked: boolean;
  sortOrder: number;
  createdAt?: string | null;
}

export async function getTravelChecklist(aiContentId: string): Promise<TravelChecklistItem[]> {
  const res = await apiFetch<{ data: TravelChecklistItem[] }>(
    `/ai/travel-plan/${aiContentId}/checklist`,
  );
  return res.data;
}

export async function addTravelChecklistItem(
  aiContentId: string,
  payload: { item: string; note?: string },
): Promise<TravelChecklistItem> {
  const res = await apiFetch<{ data: TravelChecklistItem }>(
    `/ai/travel-plan/${aiContentId}/checklist`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function updateTravelChecklistItem(
  itemId: string,
  payload: Partial<Pick<TravelChecklistItem, "item" | "note" | "checked">>,
): Promise<TravelChecklistItem> {
  const res = await apiFetch<{ data: TravelChecklistItem }>(
    `/ai/travel-plan/checklist/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function deleteTravelChecklistItem(itemId: string): Promise<void> {
  await apiFetch(`/ai/travel-plan/checklist/${itemId}`, { method: "DELETE" });
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
