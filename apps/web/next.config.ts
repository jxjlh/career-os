import type { NextConfig } from "next";
import path from "node:path";

const API_UPSTREAM = process.env.API_UPSTREAM || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
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
