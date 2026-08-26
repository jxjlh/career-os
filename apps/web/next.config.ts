import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  transpilePackages: ["@ai-aggregation/ui", "@ai-aggregation/shared", "@ai-aggregation/ai"],
  experimental: {
    typedRoutes: true,
  },
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
