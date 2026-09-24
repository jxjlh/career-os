"use client";

import { apiFetch } from "@/lib/api";

export type HealthDay = {
  date: string;
  steps: number | null;
  distanceKm: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
  sleepMinutes: number | null;
  restingHr: number | null;
  source: string;
  updatedAt: string | null;
};

export type HealthSummary = {
  days: number;
  daysWithData: number;
  avgSteps: number | null;
  avgSleepMinutes: number | null;
  avgRestingHr: number | null;
  avgActiveEnergyKcal: number | null;
  totalDistanceKm: number | null;
};

export type HealthStatus = {
  lastSyncedAt: string | null;
  last7DaysCovered: number;
  sources: string[];
  tokens: { id: string; deviceLabel: string; createdAt: string; lastUsedAt: string | null }[];
};

export type HealthTokenCreated = {
  id: string;
  token: string;
  deviceLabel: string;
};

export const SOURCE_LABELS: Record<string, string> = {
  apple_watch: "Apple Watch",
  iphone: "iPhone",
  android: "安卓",
  manual: "手动",
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const healthApi = {
  daily: (from: string, to: string) =>
    apiFetch<{ data: { from: string; to: string; days: HealthDay[] } }>(
      `/health/daily?from=${from}&to=${to}`,
    ),
  summary: (days = 7) =>
    apiFetch<{ data: HealthSummary }>(`/health/summary?days=${days}`),
  status: () => apiFetch<{ data: HealthStatus }>("/health/status"),
  manual: (body: Partial<Record<string, number | string | null>>) =>
    apiFetch<{ data: unknown }>("/health/manual", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createToken: (deviceLabel: string) =>
    apiFetch<{ data: HealthTokenCreated }>("/health/tokens", {
      method: "POST",
      body: JSON.stringify({ device_label: deviceLabel }),
    }),
  revokeToken: (id: string) =>
    apiFetch<{ data: unknown }>(`/health/tokens/${id}`, { method: "DELETE" }),
};

export function formatSleep(minutes: number | null): string {
  if (minutes == null) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
}

export function formatNumber(v: number | null, unit = ""): string {
  if (v == null) return "--";
  return `${v.toLocaleString("zh-CN")}${unit}`;
}

/** 站点自身的 API 根地址（生产走同源代理，可直接给手机用） */
export function siteApiBase(): string {
  if (typeof window === "undefined") return "/api/v1";
  return `${window.location.origin}/api/v1`;
}

/**
 * 拼一条「极简同步」网址：GET /health/quick，令牌与指标都走 query。
 * 目的：让 iPhone 快捷指令只需要一条网址，不必组装 JSON。
 */
export function buildQuickUrl(
  token: string,
  metrics: Partial<Record<string, number | string>> = {},
): string {
  const params = new URLSearchParams({ token, source: "iphone" });
  Object.entries(metrics).forEach(([k, v]) => {
    // 空字符串要保留：快捷指令模板需要 steps=（留空），方便用户把光标放末尾插入变量
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return `${siteApiBase()}/health/quick?${params.toString()}`;
}
