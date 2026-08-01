"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { redirectAfterAuth } from "@/lib/api";
import { isSupabaseConfigured, supabase, writeSessionCookie } from "@/lib/supabase";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (password !== confirmPassword) {
        setError(t("auth.passwordMismatch"));
        setLoading(false);
        return;
      }
      if (isSupabaseConfigured && supabase) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${origin}/auth/callback` },
        });
        if (authError) throw new Error(authError.message);

        // 开启邮箱确认时 signUp 不会立即返回 session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const token = data.session.access_token;
          localStorage.setItem("career_os_token", token);
          writeSessionCookie(token);
          const target = await redirectAfterAuth(null);
          router.push(target);
          router.refresh();
        } else {
          setNotice(t("auth.verifyEmailSent"));
        }
      } else {
        // dev 模式：无 Supabase，用占位 token
        localStorage.setItem("career_os_token", "dev");
        writeSessionCookie("dev");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="soft-shadow relative overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-gradient-to-br from-primary/16 to-accent/14 blur-2xl" />
      <h1 className="relative text-2xl font-bold tracking-tight">{t("auth.signup")}</h1>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted">{t("auth.signupSub")}</p>
      {!isSupabaseConfigured && (
        <p className="relative mt-4 rounded-[10px] bg-warning/10 p-2.5 text-xs leading-relaxed text-warning">
          {t("auth.devMode")}
        </p>
      )}
      <form className="relative mt-6 space-y-3.5" onSubmit={submit}>
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          type="password"
          required
          minLength={6}
          placeholder={t("auth.passwordHint")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          required
          minLength={6}
          placeholder={t("auth.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
        {notice && <p className="rounded-[10px] bg-primary/8 p-2.5 text-xs leading-relaxed text-primary">{notice}</p>}
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          <UserPlus className="h-4 w-4" />
          {loading ? t("auth.signingUp") : t("auth.signupCta")}
        </Button>
      </form>
      <p className="relative mt-5 text-center text-[13px] text-muted">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t("auth.login")}
        </Link>
      </p>
    </Card>
  );
}
