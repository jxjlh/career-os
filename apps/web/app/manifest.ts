import type { MetadataRoute } from "next";

// PWA manifest — 让 iPhone Safari 可以"添加到主屏幕"成为独立 App。
// iOS 不依赖 Service Worker 即可安装，但需要 manifest + apple-touch-icon + iOS meta。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Life OS",
    short_name: "Life OS",
    description: "AI 人生教练与成长助手 —— 目标 · 打卡 · 旅行 · 地图 · 成就",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0d14",
    theme_color: "#5b5bd6",
    categories: ["productivity", "lifestyle", "education"],
    icons: [
      {
        src: "/icons/career-os-appicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/career-os-appicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/career-os-appicon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "AI 对话",
        short_name: "对话",
        url: "/life/coach/chat",
      },
      {
        name: "今日建议",
        short_name: "建议",
        url: "/life/coach",
      },
      {
        name: "长期记忆",
        short_name: "记忆",
        url: "/life/coach/memory",
      },
    ],
  };
}
