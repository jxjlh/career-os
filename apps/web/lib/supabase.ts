import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

// 解析 JWT payload（不验签，仅读取 exp 做过期判断）
function decodeExp(token: string): number {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return typeof json.exp === "number" ? json.exp : 0;
  } catch {
    return 0;
  }
}

/**
 * 获取有效的 access_token：Supabase session 会自动刷新过期 token。
 * 关键修复：旧实现只读登录时写死的 localStorage，token 1 小时过期后所有 API 全 401。
 * 现在优先从 Supabase session 取新鲜 token；若即将过期则主动 refreshSession。
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = decodeExp(session.access_token);
  // 距过期不足 60s → 主动刷新，避免把"刚好过期"的 token 发给后端
  if (exp && exp - now < 60) {
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session?.access_token ?? null;
    } catch {
      return session.access_token;
    }
  }
  return session.access_token;
}

// 把 access_token 同步写到 cookie，供 Edge middleware 读取做路由守卫。
// 仅用于"是否登录"的页面层判断；真实鉴权仍由后端 JWT 验证完成。
export function writeSessionCookie(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `career_os_token=${token}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `career_os_token=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * 退出登录：清空 Supabase session、localStorage、cookie，然后跳转登录页。
 * 这是之前完全缺失的"切换账号"能力。
 */
export async function signOut(redirectTo = "/login"): Promise<void> {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // ignore — 即使 Supabase 清理失败也要清本地状态
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("career_os_token");
    clearSessionCookie();
    window.location.assign(redirectTo);
  }
}
