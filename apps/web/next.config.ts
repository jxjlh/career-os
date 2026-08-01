import type { NextConfig } from "next";
import path from "node:path";

const API_UPSTREAM = process.env.API_UPSTREAM || "http://127.0.0.1:8000";

// 自动检测 monorepo 根目录：如果当前目录有 workspaces 字段就用它，
// 否则向上找两级（apps/web → apps → repo root）
const findMonorepoRoot = () => {
  const cwd = process.cwd();
  try {
    const pkg = require(path.join(cwd, "package.json"));
    if (pkg.workspaces) return cwd;
  } catch {}
  return path.resolve(cwd, "../..");
};

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: findMonorepoRoot(),
  transpilePackages: [
    "@career-os/shared",
    "@career-os/utils",
    "@career-os/ui",
    "@career-os/auth",
    "@career-os/ai",
    "@career-os/search",
    "@career-os/database",
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_UPSTREAM}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
