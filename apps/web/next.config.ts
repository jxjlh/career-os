import type { NextConfig } from "next";
import path from "node:path";

const API_UPSTREAM = process.env.API_UPSTREAM || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
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
