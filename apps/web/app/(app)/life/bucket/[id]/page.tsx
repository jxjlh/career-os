import Client from "./client";

// 静态导出模式下，动态路由必须提供 generateStaticParams
// 返回空数组：不预渲染任何页面，通过客户端导航访问
// Cloudflare Pages SPA fallback 处理直接 URL 访问
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <Client />;
}
