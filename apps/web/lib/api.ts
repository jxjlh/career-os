import { getAccessToken, isSupabaseConfigured, writeSessionCookie } from "@/lib/supabase";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // 关键修复：必须用 Supabase session 里的新鲜 token，而非登录时写死的 localStorage。
  // access_token 1 小时过期；旧实现读旧值 → 后端 401 → 所有功能失效。
  let token: string | null = null;
  if (isSupabaseConfigured) {
    token = await getAccessToken();
    if (token && typeof window !== "undefined") {
      // 同步到 localStorage + cookie，让 Edge middleware 路由守卫与下次请求一致
      localStorage.setItem("career_os_token", token);
      writeSessionCookie(token);
    }
  } else if (typeof window !== "undefined") {
    token = localStorage.getItem("career_os_token");
  }
  headers.set("Authorization", token ? `Bearer ${token}` : "Bearer dev");

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
 *  - 否则直接进入系统主界面；onboarding 是可选流程，不再强制
 */
export async function redirectAfterAuth(next?: string | null): Promise<string> {
  if (next) return next;
  return "/dashboard";
}
