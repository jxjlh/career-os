import { getAccessToken } from "@/lib/supabase";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = typeof window !== "undefined" ? localStorage.getItem("career_os_token") : null;
  const sessionToken = token ? token : await getAccessToken();
  headers.set("Authorization", sessionToken ? `Bearer ${sessionToken}` : "Bearer dev");

  const url = path.startsWith("/api/v1") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string } } | null = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      payload?.error?.message || `Request failed: ${res.status}`,
      payload?.error?.code,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * 登录/注册成功后决定跳转目标：
 *  - 有 next 参数（来自 middleware 的回跳）→ 优先 next
 *  - 否则查 /auth/me：已完成 onboarding → /dashboard，否则 /onboarding
 *  - 查询失败 → 保守跳 /onboarding
 */
export async function redirectAfterAuth(next?: string | null): Promise<string> {
  if (next) return next;
  try {
    const me = await apiFetch<{ data: { onboardingCompleted: boolean } }>("/auth/me");
    return me.data.onboardingCompleted ? "/dashboard" : "/onboarding";
  } catch {
    return "/onboarding";
  }
}
