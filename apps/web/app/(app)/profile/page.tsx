"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ChevronLeft,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getCheckinStreak, getLifeDashboard, getLevelInfo } from "@/lib/life";
import { signOut, supabase } from "@/lib/supabase";

type ProfileData = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  currentTitle: string | null;
  targetTitle: string | null;
  experienceYears: number | null;
  createdAt: string | null;
};

type Envelope = { data: ProfileData };

export default function ProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const me = useQuery<Envelope>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/me"),
  });
  const dashboard = useQuery({
    queryKey: ["life-dashboard"],
    queryFn: getLifeDashboard,
  });
  const streak = useQuery({
    queryKey: ["life-checkin"],
    queryFn: getCheckinStreak,
  });

  const profile = me.data?.data;

  // 昵称编辑
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");

  // 头像上传
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  const saveName = useMutation({
    mutationFn: () =>
      apiFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({ display_name: nameInput.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditingName(false);
      setNameError("");
    },
    onError: (err) => {
      setNameError(err instanceof ApiError ? err.message : t("profilePage.saveFailed"));
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<{ data: { avatarUrl: string } }>("/me/avatar", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setAvatarError("");
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 2500);
    },
    onError: (err) => {
      setAvatarError(err instanceof ApiError ? err.message : t("profilePage.uploadFailed"));
      setAvatarSuccess(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t("profilePage.avatarTooLarge"));
      return;
    }
    setAvatarError("");
    uploadAvatar.mutate(file);
    // 清空 input 让同一文件可再次选择
    e.target.value = "";
  };

  const startEditName = () => {
    setNameInput(profile?.displayName || profile?.email?.split("@")[0] || "");
    setNameError("");
    setEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 1 || trimmed.length > 20) {
      setNameError(t("profilePage.nicknameLengthError"));
      return;
    }
    saveName.mutate();
  };

  if (me.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const displayName = profile?.displayName || profile?.email?.split("@")[0] || "YOU";
  const level = dashboard.data?.level ?? 1;
  const experience = dashboard.data?.experience ?? 0;
  const { progressPercent } = getLevelInfo(level, experience);
  const daysActive = streak.data?.totalCheckins ?? 0;

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="mx-auto max-w-2xl">
      {/* 顶部返回栏 */}
      <div className="flex items-center justify-between px-1 py-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-text"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </button>
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {t("profilePage.title")}
        </span>
      </div>

      {/* ── QQ 风格 Cover Banner + Avatar ── */}
      <Card className="overflow-hidden p-0">
        {/* 渐变 Cover */}
        <div
          className="relative h-32 w-full"
          style={{
            background:
              "linear-gradient(135deg, #a855f7 0%, #6366f1 45%, #ec4899 100%)",
          }}
        >
          {/* 装饰光晕 */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-white/10 blur-xl" />
        </div>

        {/* 头像 + 昵称区 */}
        <div className="px-6 pb-6">
          {/* 头像 —— 半悬浮在 cover 上 */}
          <div className="-mt-14 flex flex-col items-center">
            <div className="group relative">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-surface bg-surface-elevated shadow-xl">
                {profile?.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={displayName}
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary-glow text-4xl font-bold text-white">
                    {displayName[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              {/* 拍照按钮 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAvatar.isPending}
                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-lg transition-all hover:scale-105 hover:bg-primary-hover active:scale-95 disabled:opacity-60"
                aria-label={t("profilePage.editAvatar")}
              >
                {uploadAvatar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* 上传状态提示 */}
            {avatarError && (
              <p className="mt-2 text-xs text-danger">{avatarError}</p>
            )}
            {avatarSuccess && (
              <p className="mt-2 text-xs text-success">{t("profilePage.uploadSuccess")}</p>
            )}

            {/* 昵称 */}
            <div className="mt-3 flex items-center gap-2">
              {!editingName ? (
                <>
                  <h1 className="font-display text-xl font-bold tracking-tight text-text">
                    {displayName}
                  </h1>
                  <button
                    onClick={startEditName}
                    className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text"
                    aria-label={t("profilePage.editNickname")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    maxLength={20}
                    placeholder={t("profilePage.nicknamePlaceholder")}
                    className="h-9 w-48 rounded-[10px] border border-border bg-surface/80 px-3 text-center text-sm font-semibold text-text focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saveName.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                  >
                    {saveName.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNameError("");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-muted transition-colors hover:text-text"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {nameError && <p className="mt-1 text-xs text-danger">{nameError}</p>}

            {/* 邮箱（QQ号位） */}
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-text-secondary">
              <Mail className="h-3 w-3" />
              {profile?.email || "—"}
            </p>

            {/* 会员徽章 */}
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/12 px-3 py-1 text-[11px] font-semibold text-primary">
              <span className="text-[10px]">✦</span>
              {t("profilePage.memberSince")}
            </div>
          </div>

          {/* 等级进度条 */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
              <span className="font-display uppercase tracking-wider">
                LEVEL {String(level).padStart(2, "0")}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── 成长数据 ── */}
      <div className="mt-4">
        <p className="mb-2.5 px-1 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {t("profilePage.growthStats")}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label={t("profilePage.level")} value={`Lv.${level}`} />
          <StatBlock label={t("profilePage.daysActive")} value={String(daysActive)} />
          <StatBlock label={t("profilePage.studyMinutes")} value={`${Math.round(experience / 60)}m`} />
        </div>
      </div>

      {/* ── 基本信息 ── */}
      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {t("profilePage.basicInfo")}
        </p>
        <div className="space-y-3">
          <InfoRow label={t("profilePage.email")} value={profile?.email || "—"} />
          <InfoRow label={t("profilePage.nickname")} value={displayName} />
          <InfoRow
            label={t("profilePage.currentTitle")}
            value={profile?.currentTitle || "未设置"}
          />
          <InfoRow
            label={t("profilePage.targetTitle")}
            value={profile?.targetTitle || "未设置"}
            icon={<Target className="h-3.5 w-3.5 text-primary" />}
          />
          <InfoRow
            label={t("profilePage.experience")}
            value={
              profile?.experienceYears != null
                ? `${profile.experienceYears} 年`
                : "未设置"
            }
          />
          <InfoRow label={t("profilePage.joinDate")} value={joinDate} />
        </div>
      </Card>

      {/* ── 成长趋势入口 ── */}
      <Card className="mt-4 p-5">
        <button
          onClick={() => router.push("/analytics")}
          className="flex w-full items-center justify-between transition-colors hover:text-primary"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text">
            <TrendingUp className="h-4 w-4 text-primary" />
            查看成长分析
          </span>
          <ChevronLeft className="h-4 w-4 rotate-180 text-text-tertiary" />
        </button>
      </Card>

      {/* ── 账号 ── */}
      <Card className="mt-4 p-5">
        <p className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          {t("profilePage.account")}
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text">
              {profile?.email || "当前账号"}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">退出后可登录其他账号</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </Card>

      <div className="h-8" />
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-border-subtle bg-surface/60 p-3 text-center backdrop-blur-sm">
      <p className="font-display text-lg font-bold text-text">{value}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{label}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-text-secondary">{label}</span>
      <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-text">
        {icon}
        {value}
      </span>
    </div>
  );
}
