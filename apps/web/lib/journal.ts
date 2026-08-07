import { apiFetch, API_BASE } from "@/lib/api";
import { getAccessToken, isSupabaseConfigured } from "@/lib/supabase";

// ── 心情定义 ────────────────────────────────────────────────────────
export const MOODS = [
  { emoji: "😵", label: "糟糕", desc: "状态很差" },
  { emoji: "😐", label: "一般", desc: "普普通通" },
  { emoji: "🙂", label: "还行", desc: "感觉不错" },
  { emoji: "😎", label: "很好", desc: "状态在线" },
  { emoji: "✨", label: "超赞", desc: "能量满满" },
] as const;

// ── 时间段定义: 4 个主时段, 每个可展开为 2 小时子时段 ────────────────
export interface SubSlot {
  key: string;       // e.g. "morning_06"
  label: string;     // e.g. "06-08"
  startHour: number;
}

export interface MainSlot {
  key: string;       // morning / afternoon / evening / night
  label: string;    // 上午 / 下午 / 晚上 / 深夜
  icon: string;     // 🌅
  range: string;    // 06:00 — 12:00
  subSlots: SubSlot[];
}

function buildSubSlots(mainKey: string, startHour: number, endHour: number): SubSlot[] {
  const slots: SubSlot[] = [];
  for (let h = startHour; h < endHour; h += 2) {
    const end = Math.min(h + 2, endHour);
    slots.push({
      key: `${mainKey}_${String(h).padStart(2, "0")}`,
      label: `${String(h).padStart(2, "0")}-${String(end).padStart(2, "0")}`,
      startHour: h,
    });
  }
  return slots;
}

export const TIME_SLOTS: MainSlot[] = [
  {
    key: "morning",
    label: "上午",
    icon: "🌅",
    range: "06:00 — 12:00",
    subSlots: buildSubSlots("morning", 6, 12),
  },
  {
    key: "afternoon",
    label: "下午",
    icon: "☀️",
    range: "12:00 — 18:00",
    subSlots: buildSubSlots("afternoon", 12, 18),
  },
  {
    key: "evening",
    label: "晚上",
    icon: "🌆",
    range: "18:00 — 22:00",
    subSlots: buildSubSlots("evening", 18, 22),
  },
  {
    key: "night",
    label: "深夜",
    icon: "🌙",
    range: "22:00 — 06:00",
    subSlots: [
      ...buildSubSlots("night", 22, 24),
      ...buildSubSlots("night", 0, 6),
    ],
  },
];

export type TimeSlotKey = string; // 主时段 key 或子时段 key

export function getSlotMeta(key: string): MainSlot {
  // 从子时段 key (e.g. "morning_06") 中提取主时段
  const mainKey = key.split("_")[0];
  return TIME_SLOTS.find((s) => s.key === mainKey) ?? TIME_SLOTS[0];
}

export function getSubSlotMeta(key: string): SubSlot | null {
  for (const slot of TIME_SLOTS) {
    const found = slot.subSlots.find((s) => s.key === key);
    if (found) return found;
  }
  return null;
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
  time_slot?: string;
}

const API = "/journal";

export const journalApi = {
  listMonth: (year: number, month: number) =>
    apiFetch<JournalMonthResponse>(`${API}/month?year=${year}&month=${month}`),

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

  // 导出小记为 Markdown (支持按日期范围或按周)
  exportRange: async (startDate: string, endDate: string) => {
    const token = isSupabaseConfigured ? await getAccessToken() : null;
    const url = `${API_BASE}${API}/export?start=${startDate}&end=${endDate}`;
    const res = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "Bearer dev",
      },
    });
    if (!res.ok) throw new Error("导出失败");
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `journals-${startDate}_to_${endDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  },
};
