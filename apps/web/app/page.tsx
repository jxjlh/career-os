"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 静态导出下不支持 server-side redirect，改客户端跳转
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
