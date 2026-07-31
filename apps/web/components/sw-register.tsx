"use client";

import { useEffect } from "react";

/**
 * 最小 Service Worker 注册组件。
 * - 仅在生产环境注册，开发环境跳过（避免缓存干扰热更新）。
 * - SW 实现见 public/sw.js：app shell 缓存 + 网络优先策略，离线降级到缓存。
 * 注册失败不阻断页面（静默 catch）。
 */
export function SWRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 注册失败不影响主功能
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
