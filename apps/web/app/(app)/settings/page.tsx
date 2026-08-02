"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, LogOut, Moon, Save, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { signOut } from "@/lib/supabase";

type Envelope = { data: any };

export default function SettingsPage() {
  const { locale, setLocale } = useI18n();
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const me = useQuery<Envelope>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/me"),
  });
  const limits = useQuery<Envelope>({
    queryKey: ["me-limits"],
    queryFn: () => apiFetch("/me/limits"),
  });
  const [displayName, setDisplayName] = useState("");
  const [targetTitle, setTargetTitle] = useState("");

  const profile = me.data?.data;
  const limitsData = limits.data?.data;
  const save = useMutation({
    mutationFn: () =>
      apiFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName || profile?.displayName,
          target_title: targetTitle || profile?.targetTitle,
          language: locale,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <div>
      <SectionHeader title={t("nav.settings")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("settings.profile")}</h2>
          <div className="space-y-3">
            <Input
              placeholder={profile?.displayName || "Display name"}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Input
              placeholder={profile?.targetTitle || "Target title"}
              value={targetTitle}
              onChange={(e) => setTargetTitle(e.target.value)}
            />
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4" />
              {t("common.save")}
            </Button>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("settings.preferences")}</h2>
          <div className="space-y-3">
            <button
              className="flex w-full items-center justify-between rounded-[6px] border border-border p-3"
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
            >
              <span className="flex items-center gap-2 text-sm">
                <Languages className="h-4 w-4 text-muted" />
                {t("settings.language")}
              </span>
              <span className="text-sm font-medium">{locale === "zh-CN" ? "简体中文" : "English"}</span>
            </button>
            <button
              className="flex w-full items-center justify-between rounded-[6px] border border-border p-3"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <span className="flex items-center gap-2 text-sm">
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-muted" /> : <Moon className="h-4 w-4 text-muted" />}
                {t("settings.theme")}
              </span>
              <span className="text-sm font-medium">{resolvedTheme === "dark" ? "Dark" : "Light"}</span>
            </button>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">{t("settings.usage")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: t("settings.aiChat"), used: limitsData?.aiMessagesUsed ?? 0, max: limitsData?.dailyLimits?.aiMessages ?? 30 },
              { label: t("settings.search"), used: limitsData?.searchesUsed ?? 0, max: limitsData?.dailyLimits?.searches ?? 20 },
              { label: t("settings.interview"), used: limitsData?.interviewsUsed ?? 0, max: limitsData?.dailyLimits?.interviews ?? 3 },
            ].map((item) => (
              <div key={item.label} className="rounded-[6px] border border-border p-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span>{item.label}</span>
                  <span className="text-muted">
                    {item.used} / {item.max}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">账号</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-text">
                {profile?.email || "当前账号"}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">退出后可登录其他账号（切换账号）</p>
            </div>
            <Button variant="ghost" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
