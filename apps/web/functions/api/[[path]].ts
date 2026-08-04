// Cloudflare Pages Function —— API 代理
// 将前端 /api/* 请求同源代理到 Render 后端，绕过 CORS 跨域限制
// 浏览器看到的是同源请求，无需 CORS 预检，也不需要后端配置 allow_origin

/// <reference types="@cloudflare/workers-types" />

const BACKEND_ORIGIN = "https://ai-life-os-api-4y3x.onrender.com";

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // 构造后端目标 URL（保留 path + query）
  const backendUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;

  // 复制请求头，移除 host（fetch 会自动设置）
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  // 构造 fetch options
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  // GET/HEAD 不传 body，其他方法透传 body
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  try {
    const backendRes = await fetch(backendUrl, init);

    // 透传后端响应，并补充 CORS 头（同源其实不需要，但保险）
    const resHeaders = new Headers(backendRes.headers);
    resHeaders.set("Access-Control-Allow-Origin", url.origin);
    resHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    // 后端不可达（如 Render 冷启动超时）—— 返回 502 + 友好提示
    return new Response(
      JSON.stringify({
        error: {
          code: "BAD_GATEWAY",
          message: "后端服务暂不可达，可能正在冷启动，请稍后重试",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
