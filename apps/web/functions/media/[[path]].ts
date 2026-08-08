// Cloudflare Pages Function —— 本地回退媒体代理
// Supabase Storage 不可用时，后端会将图片落到 /media；这里让静态前端也能读取它。

/// <reference types="@cloudflare/workers-types" />

const BACKEND_ORIGIN = "https://ai-life-os-api-4y3x.onrender.com";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const backendUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("cf-visitor");

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return new Response("media unavailable", { status: 502 });
  }
};
