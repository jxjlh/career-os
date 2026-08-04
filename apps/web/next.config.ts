import type { NextConfig } from "next";

// Cloudflare Pages 静态导出模式
// trailingSlash: true → 生成 /login/index.html 而非 /login.html
// 避免 Cloudflare Pages 自动将 .html 重定向到无后缀的 308 循环
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
