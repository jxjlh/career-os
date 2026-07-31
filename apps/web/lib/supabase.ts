import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// 把 access_token 同步写到 cookie，供 Edge middleware 读取做路由守卫。
// 仅用于"是否登录"的页面层判断；真实鉴权仍由后端 JWT 验证完成。
export function writeSessionCookie(token: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `career_os_token=${token}; path=/; max-age=604800; SameSite=Lax`;
}
