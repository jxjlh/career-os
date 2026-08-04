"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Input } from "@/components/ui";
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
    <div className="rounded-[20px] border border-border-subtle bg-surface/60 p-7 backdrop-blur-sm">
      {/* editorial 风格小标题 */}
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
        {t("auth.loginSub")}
      </p>
      <h1 className="mt-2 font-display text-[24px] font-bold tracking-tight text-text">
        {t("auth.login")}
      </h1>
      {!isSupabaseConfigured && (
        <p className="mt-4 rounded-[10px] border border-warning/20 bg-warning/8 p-2.5 text-xs leading-relaxed text-warning">
          {t("auth.devMode")}
        </p>
      )}
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link
          href="/forgot-password"
          className="block text-right text-[12px] font-medium text-text-secondary transition-colors hover:text-primary-glow"
        >
          {t("auth.forgotPassword")}
        </Link>
        {error && <p className="rounded-[10px] border border-danger/20 bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="h-11 w-full" disabled={loading}>
          <LogIn className="h-4 w-4" />
          {loading ? t("auth.loggingIn") : t("auth.loginCta")}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-text-secondary">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-primary-glow hover:text-primary">
          {t("auth.signup")}
        </Link>
      </p>
    </div>
  );
}
