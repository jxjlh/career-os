import { apiFetch } from "@/lib/api";

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
  relationship: { icon: "❤️", labelZh: "情感关系", labelEn: "Relationships", gradient: "from-fuchsia-400/15 to-purple-500/10" },
  finance: { icon: "💰", labelZh: "财富人生", labelEn: "Finance", gradient: "from-yellow-400/15 to-lime-500/10" },
  other: { icon: "✨", labelZh: "其他目标", labelEn: "Other", gradient: "from-slate-400/15 to-slate-500/10" },
};
