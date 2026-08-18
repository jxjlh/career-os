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

const STATUS_MESSAGES: Record<number, string> = {
  400: "请求参数错误，请检查输入",
  401: "登录已过期，请重新登录",
  403: "没有权限执行此操作",
  404: "资源不存在",
  409: "该邮箱已注册，请直接登录或使用其他邮箱",
  422: "输入格式错误，请检查",
  429: "操作过于频繁，请稍后再试",
  500: "服务器内部错误，请稍后重试",
  502: "网关错误，请稍后重试",
  503: "服务暂不可用，请稍后重试",
  504: "网关超时，请稍后重试",
};

// 生产环境通过 Cloudflare Pages Function 同源代理 /api/* → Render
// 本地开发直接调本地后端
// 这样完全绕过 CORS，无需在 Render 配置 allow_origin
const DEFAULT_API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://127.0.0.1:8000/api/v1"
    : "/api/v1";
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE;

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
    const serverMsg = payload?.error?.message;
    const localizedMsg = STATUS_MESSAGES[res.status];
    const message = serverMsg || localizedMsg || `请求失败 (${res.status})`;
    throw new ApiError(message, payload?.error?.code, res.status);
  }
  if (res.status === 204) return undefined as T;
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
