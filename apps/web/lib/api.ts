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

// ── Token 缓存 ──────────────────────────────────────────────────────
// 避免每次 apiFetch 都调用 supabase.auth.getSession()（虽是本地读取，但仍有开销）。
// 缓存 token，2 分钟内复用，过期后重新获取。
let _cachedToken: string | null = null;
let _tokenCachedAt = 0;
const TOKEN_CACHE_TTL_MS = 2 * 60 * 1000; // 2 分钟

async function getCachedToken(): Promise<string | null> {
  const now = Date.now();
  // 缓存有效期内直接返回
  if (_cachedToken && now - _tokenCachedAt < TOKEN_CACHE_TTL_MS) {
    return _cachedToken;
  }
  // 获取新鲜 token
  if (isSupabaseConfigured) {
    const token = await getAccessToken();
    if (token) {
      _cachedToken = token;
      _tokenCachedAt = now;
      if (typeof window !== "undefined") {
        localStorage.setItem("career_os_token", token);
        writeSessionCookie(token);
      }
    }
    return token;
  }
  if (typeof window !== "undefined") {
    return localStorage.getItem("career_os_token");
  }
  return null;
}

/** 清除 token 缓存（登出或 401 时调用） */
export function clearTokenCache(): void {
  _cachedToken = null;
  _tokenCachedAt = 0;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getCachedToken();
  headers.set("Authorization", token ? `Bearer ${token}` : "Bearer dev");

  const url = path.startsWith("/api/v1") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    // 401 时清除 token 缓存，下次请求会重新获取
    if (res.status === 401) {
      clearTokenCache();
    }
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
