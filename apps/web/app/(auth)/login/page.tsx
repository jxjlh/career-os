"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { redirectAfterAuth } from "@/lib/api";
import { isSupabaseConfigured, supabase, writeSessionCookie } from "@/lib/supabase";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // middleware 守卫会把原目标带在 ?next= 上，登录成功后优先回跳
      const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;

      if (isSupabaseConfigured && supabase) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error(authError.message);
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const token = data.session.access_token;
          localStorage.setItem("career_os_token", token);
          writeSessionCookie(token);
        }
      } else {
        localStorage.setItem("career_os_token", "dev");
        writeSessionCookie("dev");
      }

      const target = await redirectAfterAuth(next);
      router.push(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="soft-shadow relative overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-gradient-to-br from-primary/16 to-accent/14 blur-2xl" />
      <h1 className="relative text-2xl font-bold tracking-tight">{t("auth.login")}</h1>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted">{t("auth.loginSub")}</p>
      {!isSupabaseConfigured && (
        <p className="relative mt-4 rounded-[10px] bg-warning/10 p-2.5 text-xs leading-relaxed text-warning">
          {t("auth.devMode")}
        </p>
      )}
      <form className="relative mt-6 space-y-3.5" onSubmit={submit}>
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link
          href="/forgot-password"
          className="mt-1.5 block text-right text-[12px] font-medium text-primary hover:text-primary-hover"
        >
          {t("auth.forgotPassword")}
        </Link>
        {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          <LogIn className="h-4 w-4" />
          {loading ? t("auth.loggingIn") : t("auth.loginCta")}
        </Button>
      </form>
      <p className="relative mt-5 text-center text-[13px] text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-primary hover:text-primary-hover">
          {t("auth.signup")}
        </Link>
      </p>
    </Card>
  );
}
