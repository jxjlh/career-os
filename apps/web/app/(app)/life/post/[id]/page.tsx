import Client from "./client";

// 静态导出模式下，动态路由必须提供 generateStaticParams
// 返回占位 ID：预渲染一个 fallback 页面，真实 ID 通过客户端导航访问
// Cloudflare Pages SPA fallback 处理直接 URL 访问
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <Client />;
}
