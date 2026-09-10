"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Lock, LogOut, Moon, Save, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

import { Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { journalApi } from "@/lib/journal";
import { useI18n } from "@/lib/i18n";
import { signOut } from "@/lib/supabase";

type Envelope = { data: any };

const PRIVACY_KEYS = {
  aiRead: "career_os_privacy_ai_read",
  mirror: "career_os_privacy_mirror",
  trends: "career_os_privacy_trends",
};

function usePrivacyToggle(key: string, defaultVal = true) {
  const [enabled, setEnabled] = useState(defaultVal);
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      setEnabled(stored === "true");
    }
  }, [key]);
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(key, String(next));
  };
  return { enabled, toggle };
}

function usePrivacySettings() {
  const aiRead = usePrivacyToggle(PRIVACY_KEYS.aiRead);
  const mirror = usePrivacyToggle(PRIVACY_KEYS.mirror);
  const trends = usePrivacyToggle(PRIVACY_KEYS.trends);
  return { aiRead, mirror, trends };
}

export default function SettingsPage() {
  const { locale, setLocale } = useI18n();
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const me = useQuery<Envelope>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/me"),
  });
  const [displayName, setDisplayName] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const privacy = usePrivacySettings();
  const [deleting, setDeleting] = useState<string | null>(null);

  const profile = me.data?.data;
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

  const handleDeleteJournals = async () => {
    if (!confirm(t("settings.privacyDeleteJournalConfirm"))) return;
    setDeleting("journal");
    try {
      const now = new Date();
      const data = await journalApi.listMonth(now.getFullYear(), now.getMonth() + 1);
      const journals = data?.data?.journals ?? [];
      for (const j of journals) {
        await journalApi.remove(j.id);
      }
      queryClient.invalidateQueries({ queryKey: ["journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-companion"] });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAiRecords = async () => {
    if (!confirm(t("settings.privacyDeleteAiConfirm"))) return;
    setDeleting("ai");
    try {
      queryClient.invalidateQueries({ queryKey: ["journal-companion"] });
    } finally {
      setDeleting(null);
    }
  };

  const Toggle = ({ enabled, onClick }: { enabled: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        enabled ? "bg-primary" : "bg-surface-elevated"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );

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
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-text-tertiary" />
            <h2 className="text-sm font-semibold">{t("settings.privacy")}</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[10px] border border-border p-3">
              <span className="text-[13px] text-text-secondary">{t("settings.privacyAiRead")}</span>
              <Toggle enabled={privacy.aiRead.enabled} onClick={privacy.aiRead.toggle} />
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-border p-3">
              <span className="text-[13px] text-text-secondary">{t("settings.privacyMirror")}</span>
              <Toggle enabled={privacy.mirror.enabled} onClick={privacy.mirror.toggle} />
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-border p-3">
              <span className="text-[13px] text-text-secondary">{t("settings.privacyTrends")}</span>
              <Toggle enabled={privacy.trends.enabled} onClick={privacy.trends.toggle} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={handleDeleteAiRecords}
                disabled={deleting === "ai"}
                className="flex-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[12px]">{t("settings.privacyDeleteAi")}</span>
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeleteJournals}
                disabled={deleting === "journal"}
                className="flex-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="text-[12px]">{t("settings.privacyDeleteJournal")}</span>
              </Button>
            </div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">{t("settings.usage")}</h2>
          <div className="flex items-center gap-3 rounded-[10px] border border-primary/20 bg-primary/5 p-4">
            <span className="text-2xl">∞</span>
            <div>
              <p className="text-[13px] font-medium text-text">所有功能不限量使用</p>
              <p className="mt-0.5 text-[12px] text-text-tertiary">
                AI 对话、搜索、模拟面试等全部功能均可自由使用，无每日限制。
              </p>
            </div>
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
