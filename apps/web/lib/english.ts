import { apiFetch, API_BASE } from "@/lib/api";

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

export const englishApi = {
  listBooks: () => apiFetch<{ data: WordBook[] }>("/english/books"),
  getBook: (id: string) => apiFetch<{ data: WordBook }>(`/english/books/${id}`),
  listWords: (bookId: string, offset = 0, limit = 100) =>
    apiFetch<{ data: Word[] }>(`/english/books/${bookId}/words?offset=${offset}&limit=${limit}`),
  startBook: (id: string) =>
    apiFetch<{ data: WordBook }>(`/english/books/${id}/start`, { method: "POST" }),
  getStudyQueue: (bookId: string, limit = 20) =>
    apiFetch<{ data: Word[] }>(`/english/study/queue?bookId=${bookId}&limit=${limit}`),
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
    if (bookId) params.set("bookId", bookId);
    if (difficulty) params.set("difficulty", difficulty);
    const q = params.toString();
    return apiFetch<{ data: ListeningMaterial[] }>(`/english/listening${q ? `?${q}` : ""}`);
  },
  getListening: (id: string) => apiFetch<{ data: ListeningMaterial }>(`/english/listening/${id}`),
  submitAttempt: (materialId: string, payload: { questionIndex: number; userAnswer: string; durationSeconds?: number }) =>
    apiFetch<{ data: { isCorrect: boolean; correctAnswer: string } }>(
      `/english/listening/${materialId}/attempts`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  getTodayStats: () => apiFetch<{ data: TodayStats }>("/english/stats/today"),
  getStreak: () => apiFetch<{ data: StreakStats }>("/english/stats/streak"),
};
