import { apiFetch } from "@/lib/api";

/** 一周的计划摘要（后端 /planner/weeks 返回） */
export interface WeekSummary {
  weekStart: string; // YYYY-MM-DD（周一）
  weekEnd: string;
  title: string | null;
  status: "empty" | "draft" | "active" | "reviewed";
  aiGenerated: boolean;
  totalTasks: number;
  completedTasks: number;
  /** 0~1 */
  completionRate: number;
  totalMinutes: number;
  completedMinutes: number;
  weeklyFocus: string | null;
  isCurrent: boolean;
  taskTypes: Record<string, number>;
}

export async function getWeekSummaries(limit = 16): Promise<WeekSummary[]> {
  const res = await apiFetch<{ data: WeekSummary[] }>(`/planner/weeks?limit=${limit}`);
  return res.data;
}

/** 指定周的计划；该周没有计划时 plan 为 null */
export async function getWeekPlan(
  weekStart: string,
): Promise<{ plan: any | null; exists: boolean }> {
  const res = await apiFetch<{ data: any | null; meta: { exists: boolean } }>(
    `/planner/week?weekStart=${weekStart}`,
  );
  return { plan: res.data, exists: res.meta?.exists ?? res.data !== null };
}

// ── 日期工具（全部用本地时间构造，避免 UTC 偏移把周算错） ──────────────

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 该日期所在周的周一 */
export function mondayOf(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return c;
}

export function isoWeekStart(d: Date = new Date()): string {
  return toIso(mondayOf(d));
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function shiftWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

export function formatMD(iso: string): string {
  const d = parseIso(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatWeekRange(weekStart: string): string {
  return `${formatMD(weekStart)} - ${formatMD(addDays(weekStart, 6))}`;
}

export function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
}

/**
 * 生成月历的行数据：每行是一周（周一起始）的 7 个 ISO 日期。
 * 覆盖从「当月第一天所在周的周一」到「当月最后一天所在周的周日」。
 */
export function buildMonthRows(cursor: Date): string[][] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const rows: string[][] = [];
  let weekStart = mondayOf(first);
  const endIso = toIso(last);

  while (toIso(weekStart) <= endIso) {
    const row: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      row.push(addDays(toIso(weekStart), i));
    }
    rows.push(row);
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    if (rows.length >= 6) break;
  }
  return rows;
}

/** 完成率 → 语义色（用于月历/趋势图的深浅） */
export function rateTone(rate: number, hasPlan: boolean): string {
  if (!hasPlan) return "empty";
  if (rate >= 0.999) return "full";
  if (rate >= 0.6) return "high";
  if (rate > 0) return "mid";
  return "low";
}
