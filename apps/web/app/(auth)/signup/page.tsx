"use client";

import { UserPlus, Camera, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { redirectAfterAuth, apiFetch } from "@/lib/api";
import { isSupabaseConfigured, supabase, writeSessionCookie } from "@/lib/supabase";

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("头像不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (password !== confirmPassword) {
        setError(t("auth.passwordMismatch"));
        setLoading(false);
        return;
      }
      if (isSupabaseConfigured && supabase) {
        const signupData: {
          email: string;
          password: string;
          display_name?: string;
          avatar_url?: string;
        } = { email, password };

        if (displayName.trim()) {
          signupData.display_name = displayName.trim();
        }
        if (avatarUrl) {
          signupData.avatar_url = avatarUrl;
        }

        await apiFetch<{
          data: { userId: string; email: string; emailConfirmed: boolean; displayName?: string; avatarUrl?: string };
        }>("/signup", { method: "POST", body: JSON.stringify(signupData) });

        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error(signInError.message);

        const token = signInData.session?.access_token;
        if (token) {
          localStorage.setItem("career_os_token", token);
          writeSessionCookie(token);
        }
        const target = await redirectAfterAuth(null);
        router.push(target);
        router.refresh();
      } else {
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
        {/* 头像上传 */}
        <div className="flex flex-col items-center gap-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border-subtle bg-surface transition-colors hover:border-primary/50"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <UserCircle className="h-12 w-12 text-text-tertiary group-hover:text-primary" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <p className="text-xs text-text-tertiary">点击上传头像（可选）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* 昵称 */}
        <Input
          type="text"
          placeholder="昵称（可选）"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
        />

        {/* 邮箱 */}
        <Input type="email" required placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} />

        {/* 密码 */}
        <Input
          type="password"
          required
          minLength={6}
          placeholder={t("auth.passwordHint")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* 确认密码 */}
        <Input
          type="password"
          required
          minLength={6}
          placeholder={t("auth.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="rounded-[10px] bg-danger/8 p-2.5 text-xs leading-relaxed text-danger">{error}</p>}
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