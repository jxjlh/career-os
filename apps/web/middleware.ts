import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 轻量路由守卫 —— 基于 cookie 的存在性判断（不验证签名，验证由后端 JWT 完成成）。
 *
 * 设计权衡：
 *  - Supabase session 默认存 localStorage，Edge middleware 读不到。
 *  - 登录/注册时同步把 access_token 写一份到 cookie（见 login/signup），middleware 据此放行。
 *  - cookie 仅用于"是否登录"的路由层判断；真实鉴权仍由后端 get_current_user 验证 JWT 完成。
 *  - 不引入 @supabase/ssr 依赖，零架构改动。
 */
const TOKEN_COOKIE = "career_os_token";

const APP_PREFIXES = [
  "/analytics",
  "/coach",
  "/career",
  "/dashboard",
  "/explore",
  "/interviews",
  "/jobs",
  "/library",
  "/life",
  "/onboarding",
  "/planner",
  "/projects",
  "/resume",
  "/roadmap",
  "/salary",
  "/settings",
  "/skills",
];
const AUTH_PATHS = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  const isAppPath = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // 未登录访问受保护页面 → 登录页（带回跳地址）
  if (isAppPath && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 已登录访问登录/注册页 → 仪表盘
  if (isAuthPath && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // 排除静态资源与 API；守卫 (app) 与 (auth) 路由
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)"],
};
