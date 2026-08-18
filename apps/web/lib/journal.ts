import { apiFetch } from "@/lib/api";

export interface Journal {
  id: string;
  journalDate: string;
  moodIndex: number;
  content?: string;
  tags?: string[];
  photos?: string[];
  timeSlot?: string;
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

export interface JournalResponse {
  data: Journal | null;
}

export interface JournalCreatePayload {
  mood_index: number;
  content?: string;
  tags?: string[];
  photos?: string[];
  time_slot?: string;
  goal_id?: string | null;
  skill_id?: string | null;
}

export interface JournalUpdatePayload {
  mood_index?: number;
  content?: string;
  tags?: string[];
  photos?: string[];
  time_slot?: string;
  goal_id?: string | null;
  skill_id?: string | null;
}

const API = "/journal";

export const journalApi = {
  listMonth: (year: number, month: number) =>
    apiFetch<JournalMonthResponse>(`${API}/month?year=${year}&month=${month}`),

  getByDate: (date: string) =>
    apiFetch<JournalResponse>(`${API}/${date}`),

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

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiFetch<{ data: { url: string } }>(`${API}/images`, {
      method: "POST",
      body: formData,
    });
    return data.data.url;
  },
};
