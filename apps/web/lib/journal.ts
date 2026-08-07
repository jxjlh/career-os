import { apiFetch, API_BASE } from "@/lib/api";

// 时间段定义
export const TIME_SLOTS = [
  { key: "morning", label: "上午", icon: "🌅", range: "06:00 — 12:00" },
  { key: "afternoon", label: "下午", icon: "☀️", range: "12:00 — 18:00" },
  { key: "evening", label: "晚上", icon: "🌆", range: "18:00 — 22:00" },
  { key: "night", label: "深夜", icon: "🌙", range: "22:00 — 06:00" },
] as const;

export type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];

export function getSlotMeta(key: string) {
  return TIME_SLOTS.find((s) => s.key === key) ?? TIME_SLOTS[0];
}

export interface Journal {
  id: string;
  journalDate: string;
  timeSlot: string;
  moodIndex: number;
  content?: string;
  tags?: string[];
  goalId?: string | null;
  skillId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalMonthResponse {
  data: {
    year: number;
    month: number;
    journals: Journal[];
  };
}

export interface JournalListResponse {
  data: Journal[];
}

export interface JournalResponse {
  data: Journal;
}

export interface JournalCreatePayload {
  mood_index: number;
  content?: string;
  tags?: string[];
  goal_id?: string | null;
  skill_id?: string | null;
  time_slot?: string;
  journal_date?: string;
}

export interface JournalUpdatePayload {
  mood_index?: number;
  content?: string;
  tags?: string[];
  goal_id?: string | null;
  skill_id?: string | null;
}

const API = "/journal";

export const journalApi = {
  listMonth: (year: number, month: number) =>
    apiFetch<JournalMonthResponse>(`${API}/month?year=${year}&month=${month}`),

  // 按日期获取所有时间段的小记 (返回列表)
  getByDate: (date: string) =>
    apiFetch<JournalListResponse>(`${API}/${date}`),

  create: (payload: JournalCreatePayload) =>
    apiFetch<JournalResponse>(API, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: JournalUpdatePayload) =>
    apiFetch<JournalResponse>(`${API}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    apiFetch<{ ok: boolean }>(`${API}/${id}`, {
      method: "DELETE",
    }),

  // 导出小记为 Markdown (触发下载)
  exportAll: async (year?: number) => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("career_os_token")
      : null;
    const url = year
      ? `${API_BASE}${API}/export?year=${year}`
      : `${API_BASE}${API}/export`;
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : "Bearer dev" },
    });
    if (!res.ok) throw new Error("导出失败");
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = year ? `journals-${year}.md` : "journals-all.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  },
};
