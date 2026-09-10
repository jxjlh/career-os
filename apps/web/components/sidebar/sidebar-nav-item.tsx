"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export type SidebarNavItemProps = {
  href: string;
  icon: React.ElementType | null;
  label: string;
  compact?: boolean;
  isAI?: boolean;
};

export function SidebarNavItem({ href, icon: Icon, label, compact = false, isAI = false }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] font-medium transition-all duration-200 ease-out",
        active
          ? "bg-primary/10 text-primary"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-line"
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      )}
      {isAI ? (
        <span
          className={cn(
            "shrink-0 text-[16px] leading-none transition-all duration-200 ease-out",
            active
              ? "text-primary"
              : "text-ai group-hover:text-text-secondary",
          )}
        >
          ✦
        </span>
      ) : Icon ? (
        <Icon
          className={cn(
            "h-[19px] w-[19px] shrink-0 transition-all duration-200 ease-out",
            active
              ? "text-primary"
              : "text-text-tertiary group-hover:text-text-secondary",
          )}
        />
      ) : null}
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}
