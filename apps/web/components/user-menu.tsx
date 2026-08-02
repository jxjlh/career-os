"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { signOut, supabase } from "@/lib/supabase";

/**
 * 右上角用户头像下拉菜单 —— 提供之前缺失的"退出登录 / 切换账号"能力。
 * 点击头像展开：显示当前登录邮箱 + 退出登录按钮。
 */
export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 拉取当前登录用户邮箱用于展示
    if (!supabase) return;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-1 rounded-full transition-transform hover:scale-105"
        onClick={() => setOpen((v) => !v)}
        aria-label="账号菜单"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary via-[#7a5cd6] to-accent text-xs font-bold text-white shadow-[0_8px_18px_-8px_rgba(91,91,214,0.7)]">
          {initial}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" />
      </button>

      {open && (
        <div className="glass absolute right-0 top-12 z-50 w-60 rounded-[14px] border border-border/70 p-2 shadow-[0_18px_40px_-12px_rgba(23,21,31,0.28)]">
          <div className="flex items-center gap-2.5 rounded-[10px] bg-surface-muted/60 p-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-text">{email || "未登录"}</p>
              <p className="text-[11px] text-muted">已登录</p>
            </div>
          </div>
          <button
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] text-danger transition-colors hover:bg-danger/8 disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              await signOut();
            }}
            disabled={busy}
          >
            <LogOut className="h-4 w-4" />
            {busy ? "正在退出..." : "退出登录"}
          </button>
          <div className="mt-1 flex items-center gap-2 border-t border-border/60 px-2.5 py-2 text-[11px] text-muted">
            <User className="h-3 w-3" />
            <span>切换账号请先退出再登录</span>
          </div>
        </div>
      )}
    </div>
  );
}
