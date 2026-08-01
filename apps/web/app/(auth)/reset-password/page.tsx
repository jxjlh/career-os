"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { isSupabaseConfigured, supabase, writeSessionCookie } from "@/lib/supabase";

function ResetPasswordInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const exchangedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (exchangedRef.current) return;
    const activate = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError(t("auth.resetLinkInvalid"));
        return;
      }
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      let exchangeError: { message: string } | null = null;
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchangeError = error;
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        exchangeError = error;
      } else {
        setError(t("auth.resetLinkInvalid"));
        return;
      }
      exchangedRef.current = true;
      if (exchangeError) {
        setError(t("auth.resetLinkInvalid"));
        return;
      }
      setReady(true);
    };
    void activate();
  }, [searchParams, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      if (!supabase) throw new Error(t("auth.resetLinkInvalid"));
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        localStorage.setItem("career_os_token", data.session.access_token);
        writeSessionCookie(data.session.access_token);
      }
      setNotice(t("auth.passwordUpdated"));
      window.setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetLinkInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="soft-shadow relative overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-gradient-to-br from-primary/16 to-accent/14 blur-2xl" />
      <h1 className="relative text-2xl font-bold tracking-tight">{t("auth.resetPasswordTitle")}</h1>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted">{t("auth.resetPasswordSub")}</p>
      {!ready && !error && <p className="relative mt-6 text-[13px] text-muted">{t("common.loading")}</p>}
      {error && <p className="relative mt-6 rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
      {notice && <p className="relative mt-6 rounded-[10px] bg-primary/8 p-2.5 text-xs leading-relaxed text-primary">{notice}</p>}
      {ready && (
        <form className="relative mt-6 space-y-3.5" onSubmit={submit}>
          <Input
            type="password"
            required
            minLength={6}
            placeholder={t("auth.newPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder={t("auth.confirmNewPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            <KeyRound className="h-4 w-4" />
            {loading ? t("common.loading") : t("auth.resetPasswordCta")}
          </Button>
        </form>
      )}
      <p className="relative mt-5 text-center text-[13px] text-muted">
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
