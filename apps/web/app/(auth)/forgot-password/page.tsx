"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (!isSupabaseConfigured || !supabase) {
        setError(t("auth.devMode"));
        setLoading(false);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (authError) throw new Error(authError.message);
      setNotice(t("auth.resetSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetLinkInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="soft-shadow relative overflow-hidden p-7">
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-gradient-to-br from-primary/16 to-accent/14 blur-2xl" />
      <h1 className="relative text-2xl font-bold tracking-tight">{t("auth.forgotPasswordTitle")}</h1>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted">{t("auth.forgotPasswordSub")}</p>
      <form className="relative mt-6 space-y-3.5" onSubmit={submit}>
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
        {notice && <p className="rounded-[10px] bg-primary/8 p-2.5 text-xs leading-relaxed text-primary">{notice}</p>}
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          <KeyRound className="h-4 w-4" />
          {loading ? t("common.loading") : t("auth.forgotPasswordCta")}
        </Button>
      </form>
      <p className="relative mt-5 text-center text-[13px] text-muted">
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </Card>
  );
}
