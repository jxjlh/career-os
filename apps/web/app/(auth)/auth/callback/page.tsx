"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { supabase } from "@/lib/supabase";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    const run = async () => {
      if (code && supabase) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          localStorage.setItem("career_os_token", data.session.access_token);
        }
      }
      router.replace("/onboarding");
    };
    void run();
  }, [code, router]);

  return <p className="text-center text-sm text-muted">正在完成登录...</p>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
