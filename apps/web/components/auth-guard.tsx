"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * 客户端路由守卫 —— 平移自 middleware.ts（Edge middleware 在 output:"export" 下不工作）。
 *
 * 设计：
 *  - 仅检查 localStorage/cookie 中是否存在 career_os_token（不验签，真实鉴权由后端 JWT 完成）
 *  - 未登录访问受保护页面 → 跳转 /login?next=...
 *  - 已登录访问 /login、/signup → 跳转 /dashboard
 *  - 首次渲染先返回 null，避免闪烁（等 effect 跑完再决定渲染）
 */
const TOKEN_KEY = "career_os_token";

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

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

    const isAppPath = APP_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    const isAuthPath = AUTH_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );

    if (isAppPath && !token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAuthPath && token) {
      router.replace("/dashboard");
      return;
    }
  }, [pathname, router]);

  return <>{children}</>;
}
