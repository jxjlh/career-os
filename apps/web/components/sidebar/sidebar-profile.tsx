"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getCheckinStreak, getLifeDashboard, getLevelInfo } from "@/lib/life";
import { supabase } from "@/lib/supabase";

type ProfileData = {
  displayName: string | null;
  avatarUrl: string | null;
};
type Envelope = { data: ProfileData };

export function SidebarProfile({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""))
      .catch(() => {});
  }, []);

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

  const level = dashboard.data?.level ?? 1;
  const experience = dashboard.data?.experience ?? 0;
  const { progressPercent } = getLevelInfo(level, experience);
  const daysActive = streak.data?.totalCheckins ?? 0;

  const avatarUrl = me.data?.data?.avatarUrl;
  const name = me.data?.data?.displayName || (email ? email.split("@")[0] : "YOU");
  const initial = (me.data?.data?.displayName || email || "U")[0].toUpperCase();

  if (compact) {
    return (
      <Link href="/profile" className="flex justify-center px-2 py-2 transition-transform hover:scale-105">
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-white">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
          ) : (
            initial
          )}
        </span>
      </Link>
    );
  }

  return (
    <Link href="/profile" className="block transition-colors hover:bg-surface-elevated/60">
      <div className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-white">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-text">{name}</p>
            <p className="font-display text-[10px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
              LEVEL {String(level).padStart(2, "0")}
            </p>
          </div>
        </div>
        <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="mt-1.5 font-display text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
          {daysActive} DAYS ACTIVE
        </p>
      </div>
    </Link>
  );
}
