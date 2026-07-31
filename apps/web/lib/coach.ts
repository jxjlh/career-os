import { apiFetch } from "@/lib/api";

// ── 对话 / 消息 ──────────────────────────────────────────────────────
export interface ToolCallInfo {
  tool: string;
  result?: Record<string, unknown> | null;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: ToolCallInfo[];
  createdAt: string;
}

export interface ChatRequest {
  conversationId?: string | null;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  message: CoachMessage;
  title?: string | null;
}

export interface ConversationItem {
  id: string;
  title?: string | null;
  summary?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: ConversationItem;
  messages: CoachMessage[];
}

export async function chatWithCoach(payload: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/ai/coach/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listConversations(): Promise<ConversationItem[]> {
  return apiFetch<ConversationItem[]>("/ai/coach/conversations");
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch<ConversationDetail>(`/ai/coach/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await apiFetch<void>(`/ai/coach/conversations/${id}`, { method: "DELETE" });
}

// ── 今日建议 / 提醒 ──────────────────────────────────────────────────
export type AdvicePriority = "low" | "medium" | "high";
export type AdviceCategory =
  | "goal"
  | "bucket"
  | "record"
  | "social"
  | "health"
  | "growth"
  | "general";
export type ReminderType =
  | "streak"
  | "overdue"
  | "travel"
  | "backlog"
  | "achievement";
export type ReminderSeverity = "info" | "warning" | "urgent";

export interface CoachAdviceItem {
  title: string;
  description: string;
  priority: AdvicePriority;
  category: AdviceCategory;
  lifeGoalId?: string | null;
}

export interface CoachReminder {
  type: ReminderType;
  title: string;
  detail: string;
  severity: ReminderSeverity;
}

export interface CoachAdvice {
  date: string;
  greeting?: string | null;
  advice: CoachAdviceItem[];
  reminders: CoachReminder[];
  motivation?: string | null;
  source: "ai" | "fallback";
}

export async function getCoachAdvice(): Promise<CoachAdvice> {
  return apiFetch<CoachAdvice>("/ai/coach/advice", { method: "POST" });
}

// ── 深度分析 ──────────────────────────────────────────────────────────
export interface AnalyzeRequest {
  topic: string;
  conversationId?: string | null;
}

export interface AnalyzeResponse {
  topic: string;
  analysis: string;
  references: Array<Record<string, unknown>>;
  source: string;
}

export async function analyzeWithCoach(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  return apiFetch<AnalyzeResponse>("/ai/coach/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── 周报 / 月报 ──────────────────────────────────────────────────────
export interface ReviewResponse {
  period: "week" | "month";
  title?: string | null;
  summary?: string | null;
  highlights: string[];
  metrics: Record<string, number | string>;
  suggestions: string[];
  reflection?: string | null;
  source: string;
}

export async function getWeeklyReview(): Promise<ReviewResponse> {
  return apiFetch<ReviewResponse>("/ai/coach/weekly-review", { method: "POST" });
}

export async function getMonthlyReview(): Promise<ReviewResponse> {
  return apiFetch<ReviewResponse>("/ai/coach/monthly-review", { method: "POST" });
}

// ── 长期记忆 ──────────────────────────────────────────────────────────
export type MemoryType =
  | "goal"
  | "interest"
  | "travel"
  | "learning"
  | "career"
  | "language"
  | "budget";

export interface MemoryItem {
  id: string;
  memoryType: string;
  content: string;
  importance: number;
  source: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface MemoryCreate {
  memoryType: string;
  content: string;
  importance: number;
  source?: string;
}

export interface MemoryUpdate {
  content?: string;
  importance?: number;
}

export async function listMemory(): Promise<MemoryItem[]> {
  return apiFetch<MemoryItem[]>("/ai/coach/memory");
}

export async function createMemory(payload: MemoryCreate): Promise<MemoryItem> {
  return apiFetch<MemoryItem>("/ai/coach/memory", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMemory(
  id: string,
  payload: MemoryUpdate,
): Promise<MemoryItem> {
  return apiFetch<MemoryItem>(`/ai/coach/memory/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await apiFetch<void>(`/ai/coach/memory/${id}`, { method: "DELETE" });
}

// ── 教练任务 ──────────────────────────────────────────────────────────
export type CoachTaskStatus = "todo" | "done" | "postponed";

export interface CoachTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: CoachTaskStatus;
  priority: AdvicePriority;
  source: string;
  lifeGoalId?: string | null;
  dueDate?: string | null;
  createdAt: string;
}

export interface CoachTaskUpdate {
  status?: CoachTaskStatus;
  priority?: AdvicePriority;
}

export async function listCoachTasks(status?: CoachTaskStatus): Promise<CoachTaskItem[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<CoachTaskItem[]>(`/ai/coach/tasks${qs}`);
}

export async function updateCoachTask(
  id: string,
  payload: CoachTaskUpdate,
): Promise<CoachTaskItem> {
  return apiFetch<CoachTaskItem>(`/ai/coach/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCoachTask(id: string): Promise<void> {
  await apiFetch<void>(`/ai/coach/tasks/${id}`, { method: "DELETE" });
}

// ── 元信息 ────────────────────────────────────────────────────────────
export const MEMORY_TYPE_LABELS: Record<string, string> = {
  goal: "长期目标",
  interest: "兴趣",
  travel: "旅行偏好",
  learning: "学习方向",
  career: "职业方向",
  language: "语言",
  budget: "预算偏好",
};

export const PRIORITY_LABELS: Record<AdvicePriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const REMINDER_SEVERITY_LABELS: Record<ReminderSeverity, string> = {
  info: "提醒",
  warning: "注意",
  urgent: "紧急",
};

export const TASK_STATUS_LABELS: Record<CoachTaskStatus, string> = {
  todo: "待办",
  done: "已完成",
  postponed: "已延期",
};
