"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export type SidebarNavItemProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  /** 是否处于折叠态（只显 icon） */
  compact?: boolean;
};

/**
 * 单个 sidebar 导航项。
 * Active 状态：左侧 2px accent line（layoutId 跨 item 平滑滑动）+ 极轻微渐变背景 + icon glow。
 * 不使用传统紫色大矩形。
 */
export function SidebarNavItem({ href, icon: Icon, label, compact = false }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-200 ease-out",
        active
          ? "bg-gradient-to-r from-primary/8 to-transparent text-text"
          : "text-text-secondary hover:bg-surface-elevated/60 hover:text-text",
      )}
    >
      {/* 左侧 2px accent line —— layoutId 让它在 item 间平滑滑动 */}
      {active && (
        <motion.span
          layoutId="sidebar-active-line"
          className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary-glow"
          style={{ boxShadow: "0 0 12px var(--primary-glow)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-all duration-200 ease-out",
          active
            ? "text-primary-glow drop-shadow-[0_0_6px_var(--primary-glow)]"
            : "group-hover:scale-110",
        )}
      />
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}
