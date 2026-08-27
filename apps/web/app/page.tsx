"use client";

import { useEffect } from "react";

// 静态导出下不支持 server-side redirect，改客户端跳转
export default function Home() {
  useEffect(() => {
    window.location.replace("/dashboard/");
  }, []);
  return null;
}
