"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function SignupPage() {
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
      if (isSupabaseConfigured && supabase) {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw new Error(authError.message);
      } else {
        localStorage.setItem("career_os_token", "dev");
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">{t("auth.signup")}</h1>
      <p className="mt-1 text-[13px] text-muted">{t("auth.signupSub")}</p>
      {!isSupabaseConfigured && (
        <p className="mt-3 rounded-[6px] bg-warning/10 p-2 text-xs text-warning">
          {t("auth.devMode")}
        </p>
      )}
      <form className="mt-5 space-y-3" onSubmit={submit}>
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          type="password"
          required
          minLength={6}
          placeholder={t("auth.passwordHint")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          <UserPlus className="h-4 w-4" />
          {loading ? t("auth.signingUp") : t("auth.signupCta")}
        </Button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">
        {t("auth.haveAccount")} <Link href="/login" className="text-primary">{t("auth.login")}</Link>
      </p>
    </Card>
  );
}
