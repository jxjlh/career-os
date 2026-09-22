"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep(2);
      setNotice(t("auth.resetSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetLinkInvalid"));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
      });
      setNotice(t("auth.passwordUpdated"));
      window.setTimeout(() => router.push("/login"), 1200);
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
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-muted">
        {step === 1 ? t("auth.forgotPasswordSub") : t("auth.resetPasswordSub")}
      </p>

      {step === 1 ? (
        <form className="relative mt-6 space-y-3.5" onSubmit={requestCode}>
          <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
          {notice && <p className="rounded-[10px] bg-primary/8 p-2.5 text-xs leading-relaxed text-primary">{notice}</p>}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            <KeyRound className="h-4 w-4" />
            {loading ? t("common.loading") : t("auth.forgotPasswordCta")}
          </Button>
        </form>
      ) : (
        <form className="relative mt-6 space-y-3.5" onSubmit={submitReset}>
          <Input readOnly value={email} className="opacity-60" />
          <Input required placeholder={t("auth.verificationCode")} value={code} onChange={(e) => setCode(e.target.value)} />
          <Input type="password" required placeholder={t("auth.newPassword")} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input type="password" required placeholder={t("auth.confirmNewPassword")} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
          {notice && <p className="rounded-[10px] bg-primary/8 p-2.5 text-xs leading-relaxed text-primary">{notice}</p>}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            <KeyRound className="h-4 w-4" />
            {loading ? t("common.loading") : t("auth.resetPasswordCta")}
          </Button>
          <button type="button" className="w-full text-center text-[13px] text-muted hover:text-primary" onClick={() => void requestCode()}>
            {t("auth.resendCode")}
          </button>
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
