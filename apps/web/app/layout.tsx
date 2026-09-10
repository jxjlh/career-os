import type { Metadata, Viewport } from "next";

import { Providers } from "@/components/providers";
import { SWRegister } from "@/components/sw-register";
import "./globals.css";

const fontVars = {
  "--font-display": "'Helvetica Neue', 'PingFang SC', 'Noto Sans SC', sans-serif",
  "--font-body": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif",
  "--font-mono": "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
} as React.CSSProperties;

// PWA metadata —— iOS Safari "添加到主屏幕" 所需：
//  - manifest 链接（Next.js 自动生成 /manifest.webmanifest）
//  - apple-touch-icon（180x180，无圆角无 alpha 更佳）
//  - appleWebApp：standalone 全屏、状态栏样式
export const metadata: Metadata = {
  title: "CareerOS - 你的长期人生教练",
  description: "基于 AI 的人生目标管理与成长助手 —— 目标 · 打卡 · 旅行 · 地图 · 成就",
  applicationName: "CareerOS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CareerOS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/career-os-appicon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/career-os-appicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

// Next.js 15：viewport 配置需单独导出
// themeColor 改 #09090B 与 dark-first 背景一致
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F8F9FC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className="light"
      style={fontVars}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
        <SWRegister />
      </body>
    </html>
  );
}
