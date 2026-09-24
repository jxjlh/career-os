import { apiFetch, API_BASE } from "@/lib/api";

/** 浏览器原生语音合成 —— 即时发音，零网络延迟 */
let cachedVoice: SpeechSynthesisVoice | null = null;

function initVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice = voices.find((v) => v.lang.startsWith("en")) ?? null;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  initVoices();
  window.speechSynthesis.onvoiceschanged = initVoices;
}

export function speak(text: string, lang = "en-US", rate = 0.9) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = rate;
  if (!cachedVoice) initVoices();
  if (cachedVoice) utter.voice = cachedVoice;
  window.speechSynthesis.speak(utter);
}

export interface WordBook {
  id: string;
  code: string;
  name: string;
  level: string;
  description?: string;
  totalWords: number;
  masteredCount: number;
  learningCount: number;
  newCount: number;
  learnedCount: number;
  progress: number;
}

export interface Word {
  id: string;
  bookId: string;
  spelling: string;
  phonetic?: string;
  pos?: string;
  meaning: string;
  exampleEn?: string;
  exampleZh?: string;
  aiMnemonic?: string;
  status: "new" | "learning" | "review" | "mastered";
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueDate?: string;
  isStarred: boolean;
  lastReviewedAt?: string;
}

export interface ListeningMaterial {
  id: string;
  bookId?: string;
  title: string;
  transcript: string;
  translation?: string;
  difficulty: "easy" | "medium" | "hard";
  durationSeconds?: number;
  audioUrl?: string;
  audioStatus: string;
  questions: ListeningQuestion[];
  isAiGenerated: boolean;
  attempted: boolean;
  createdAt?: string;
  /** 生成时用到的词表（来自正在背的词书） */
  vocabulary?: string[];
}

export interface GenerateListeningPayload {
  level?: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard";
  bookId?: string;
  voice?: string;
}

export const LISTENING_LEVELS = ["CET-4", "CET-6", "考研", "雅思", "托福"] as const;
export const LISTENING_TOPICS = ["校园生活", "职场面试", "旅行出行", "科技前沿", "购物消费", "健康运动"] as const;
export const LISTENING_VOICES = [
  { key: "catherine", label: "英式女声" },
  { key: "henry", label: "美式男声" },
] as const;

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

/**
 * 占位释义判定：词库导入时缺失的中文被填成 '暂无释义' 这类字符串，
 * 不是真释义。全站统一用它决定是显示释义还是显示「待补充」。
 */
const PLACEHOLDER_MEANINGS = new Set([
  "暂无释义",
  "暂无翻译",
  "暂无",
  "无",
  "—",
  "-",
  "",
]);

export function isPlaceholderMeaning(meaning?: string | null): boolean {
  const value = (meaning ?? "").trim();
  return value === "" || PLACEHOLDER_MEANINGS.has(value);
}

/** 释义展示：占位符返回 null，由调用方决定空态文案 */
export function displayMeaning(meaning?: string | null): string | null {
  return isPlaceholderMeaning(meaning) ? null : (meaning ?? "").trim();
}

/** 时长格式化：秒 → m:ss（注意分钟要向下取整，否则 30 秒会被显示成 1:30） */
export function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface ListeningQuestion {
  type: "fill_blank" | "choice";
  question: string;
  answer: string;
  hint?: string;
  options?: string[];
}

export interface TodayStats {
  newWords: number;
  reviewWords: number;
  masteredWords: number;
  listeningCount: number;
  listeningCorrect: number;
  durationMinutes: number;
}

export interface StreakStats {
  streak: number;
  calendar: { date: string; newWords: number; reviewWords: number; total: number }[];
}

export interface WeeklyPlan {
  bookId: string;
  bookName: string;
  weekStart: string;
  isSunday: boolean;
  dailyNewWords: number;
  estimatedReviewWords: number;
  weekDaysRemaining: number;
  progress: {
    mastered: number;
    learning: number;
    new: number;
    total: number;
  };
  todayTask: {
    newWords: number;
    reviewWords: number;
    weekReviewWords: number;
  };
  againCount: number;
  dueCount: number;
  totalWords: number;
}

// 内存缓存，用于减少重复请求
const _cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30秒缓存有效期

function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }
  return fetcher().then((data) => {
    _cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

export const englishApi = {
  listBooks: () =>
    getCached("books", () => apiFetch<{ data: WordBook[] }>("/english/books")),
  getBook: (id: string) => apiFetch<{ data: WordBook }>(`/english/books/${id}`),
  listWords: (bookId: string, offset = 0, limit = 100) =>
    apiFetch<{ data: Word[] }>(`/english/books/${bookId}/words?offset=${offset}&limit=${limit}`),
  startBook: (id: string) =>
    getCached(`book_start_${id}`, () =>
      apiFetch<{ data: WordBook }>(`/english/books/${id}/start`, { method: "POST" }),
    ),
  getStudyQueue: (bookId: string, limit = 20) =>
    apiFetch<{ data: Word[] }>(`/english/study/queue?book_id=${bookId}&limit=${limit}`),
  reviewWord: (wordId: string, rating: "again" | "hard" | "good" | "easy") =>
    apiFetch<{ data: Word }>(`/english/words/${wordId}/review`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    }),
  toggleStar: (wordId: string, isStarred: boolean) =>
    apiFetch<{ data: Word }>(`/english/words/${wordId}`, {
      method: "PATCH",
      body: JSON.stringify({ isStarred }),
    }),
  pronunciationUrl: (wordId: string) => `${API_BASE}/english/words/${wordId}/pronunciation`,
  listListening: (bookId?: string, difficulty?: string) => {
    const params = new URLSearchParams();
    if (bookId) params.set("book_id", bookId);
    if (difficulty) params.set("difficulty", difficulty);
    const q = params.toString();
    return apiFetch<{ data: ListeningMaterial[] }>(`/english/listening${q ? `?${q}` : ""}`);
  },
  getListening: (id: string) => apiFetch<{ data: ListeningMaterial }>(`/english/listening/${id}`),
  /** AI 生成本篇听力材料（联动词书选词 + TTS 合成音频） */
  generateListening: (payload: GenerateListeningPayload) =>
    apiFetch<{ data: ListeningMaterial }>("/english/listening/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** 音频地址：材料没音频时后端会懒合成一次再重定向 */
  listeningAudioUrl: (id: string, voice?: string) =>
    `${API_BASE}/english/listening/${id}/audio${voice ? `?voice=${encodeURIComponent(voice)}` : ""}`,
  submitAttempt: (materialId: string, payload: { questionIndex: number; userAnswer: string; durationSeconds?: number }) =>
    apiFetch<{ data: { isCorrect: boolean; correctAnswer: string } }>(
      `/english/listening/${materialId}/attempts`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  getTodayStats: () =>
    getCached("today_stats", () => apiFetch<{ data: TodayStats }>("/english/stats/today")),
  getStreak: () =>
    getCached("streak", () => apiFetch<{ data: StreakStats }>("/english/stats/streak")),
  getWeeklyPlan: (bookId: string) =>
    getCached(`weekly_plan_${bookId}`, () =>
      apiFetch<{ data: WeeklyPlan }>(`/english/books/${bookId}/weekly-plan`),
    ),
  invalidateCache: (key?: string) => {
    if (key) {
      _cache.delete(key);
    } else {
      _cache.clear();
    }
  },
};
