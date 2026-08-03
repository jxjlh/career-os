"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getCheckinStreak, getLifeDashboard, getLevelInfo } from "@/lib/life";
import { supabase } from "@/lib/supabase";

/**
 * Sidebar 底部用户 Profile —— 头像 + 名字 + LEVEL + 细进度条 + DAYS ACTIVE。
 * 数据来自 /life/dashboard（level/experience）+ /life/checkin（totalCheckins 兜底 daysActive）。
 */
export function SidebarProfile({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""))
      .catch(() => {});
  }, []);

  const dashboard = useQuery({
    queryKey: ["life-dashboard"],
    queryFn: getLifeDashboard,
  });
  const streak = useQuery({
    queryKey: ["life-checkin"],
    queryFn: getCheckinStreak,
  });

  const level = dashboard.data?.level ?? 1;
  const experience = dashboard.data?.experience ?? 0;
  const { progressPercent } = getLevelInfo(level, experience);
  // TODO: 后端补 /dashboard/life-stats 接口后，daysActive 用精确字段；暂用 totalCheckins 兜底
  const daysActive = streak.data?.totalCheckins ?? 0;
  const name = email ? email.split("@")[0] : "YOU";

  if (compact) {
    return (
      <div className="flex justify-center px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-white">
          {email ? email[0].toUpperCase() : "U"}
        </span>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-white">
          {email ? email[0].toUpperCase() : "U"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-text">{name}</p>
          <p className="font-display text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            LEVEL {String(level).padStart(2, "0")}
          </p>
        </div>
      </div>
      {/* 极细进度条 */}
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="mt-1.5 font-display text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
        {daysActive} DAYS ACTIVE
      </p>
    </div>
  );
}
