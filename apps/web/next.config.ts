import type { NextConfig } from "next";
import path from "node:path";

// 本地开发 → 127.0.0.1:8000；生产构建（Vercel）→ Render 后端
// 之前 Vercel 没设置 API_UPSTREAM，默认指向 127.0.0.1:8000 导致 API 全部 000 失败
const isDev = process.env.NODE_ENV === "development";
const API_UPSTREAM =
  process.env.API_UPSTREAM ||
  (isDev ? "http://127.0.0.1:8000" : "https://ai-life-os-api-4y3x.onrender.com");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_UPSTREAM}/api/v1/:path*`,
      },
      {
        source: "/media/:path*",
        destination: `${API_UPSTREAM}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
