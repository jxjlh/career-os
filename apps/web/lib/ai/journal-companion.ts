import { apiFetch } from "@/lib/api";
import type { Journal } from "@/lib/journal";

// ── AI 陪伴模式 ────────────────────────────────────────────────────
export type CompanionMode = "listen" | "chat" | "calm" | "reflect";

export const COMPANION_MODES: Record<
  CompanionMode,
  { label: string; desc: string; emoji: string }
> = {
  listen: { label: "只是听听", desc: "你说，我听", emoji: "👂" },
  chat: { label: "陪我聊聊", desc: "正常对话", emoji: "💬" },
  calm: { label: "陪我缓一缓", desc: "情绪调节", emoji: "☁️" },
  reflect: { label: "帮我想明白", desc: "自我梳理", emoji: "🌱" },
};

// ── AI 听见结果 ────────────────────────────────────────────────────
export interface JournalCompanionResult {
  /** AI 的一句温柔回应 */
  reflection?: string;
  /** 今天出现得比较多的情绪主题 */
  moodThemes?: string[];
  /** AI 的温和观察 */
  gentleObservation?: string;
  /** 建议的对话模式 */
  suggestedMode?: CompanionMode;
  /** 是否检测到高风险内容 */
  isHighRisk?: boolean;
}

// ── 情绪镜子 ────────────────────────────────────────────────────────
export interface EmotionMirror {
  date: string;
  /** 今天的你（一句话概括） */
  summary: string;
  /** 今天出现得比较多的情绪 */
  moodTags: { emoji: string; label: string }[];
  /** AI 注意到的 */
  observation: string;
  /** 也许真正困扰你的 */
  insight?: string;
}

// ── 心理天气 ────────────────────────────────────────────────────────
export interface MoodWeather {
  /** 天气图标序列 */
  forecast: { date: string; weather: string; mood: number }[];
  /** 最近的你（一句话概括） */
  summary: string;
}

// ── 长期模式 ────────────────────────────────────────────────────────
export interface LongTermPattern {
  /** AI 发现的小规律 */
  pattern: string;
  /** 关联词语 */
  relatedWords?: string[];
  /** AI 的总结 */
  conclusion?: string;
}

// ── 关于某个词 ──────────────────────────────────────────────────────
export interface WordInsight {
  word: string;
  count: number;
  coOccurrences: string[];
  aiObservation: string;
}

// ── 聊天消息 ────────────────────────────────────────────────────────
export interface CompanionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: CompanionMode;
  createdAt?: string;
}

// ── 聊天会话 ────────────────────────────────────────────────────────
export interface CompanionSession {
  id: string;
  mode: CompanionMode;
  journalId?: string;
  messages: CompanionMessage[];
  createdAt?: string;
}

// ── 安全模式 ────────────────────────────────────────────────────────
export interface SafetyResponse {
  isHighRisk: boolean;
  message: string;
  resources: { label: string; action: string }[];
}

// ── API 调用 ────────────────────────────────────────────────────────
const API = "/ai/journal-companion";

export const journalCompanionApi = {
  /** AI 听见：分析当天小记，生成温柔回应 */
  hear: (journals: Journal[]) =>
    apiFetch<{ data: JournalCompanionResult }>(`${API}/hear`, {
      method: "POST",
      body: JSON.stringify({ journals }),
    }),

  /** 情绪镜子：生成当天情绪概览 */
  getMirror: (date: string) =>
    apiFetch<{ data: EmotionMirror }>(`${API}/mirror?date=${date}`),

  /** 心理天气：7/30 天情绪天气 */
  getWeather: (days: 7 | 30 = 7) =>
    apiFetch<{ data: MoodWeather }>(`${API}/weather?days=${days}`),

  /** 长期模式：AI 发现的长期规律 */
  getPatterns: () =>
    apiFetch<{ data: LongTermPattern[] }>(`${API}/patterns`),

  /** 关于某个词：词语频率分析 */
  getWordInsight: (word: string) =>
    apiFetch<{ data: WordInsight }>(`${API}/word?word=${encodeURIComponent(word)}`),

  /** AI 陪伴对话：发送消息 */
  chat: (sessionId: string | null, mode: CompanionMode, message: string, journalId?: string) =>
    apiFetch<{ data: { sessionId: string; reply: string; isHighRisk?: boolean } }>(
      `${API}/chat`,
      {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          mode,
          message,
          journal_id: journalId,
        }),
      }
    ),

  /** 获取会话历史 */
  getSessions: () =>
    apiFetch<{ data: CompanionSession[] }>(`${API}/sessions`),

  /** 获取会话消息 */
  getSession: (sessionId: string) =>
    apiFetch<{ data: CompanionSession }>(`${API}/sessions/${sessionId}`),
};
