"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui";

export type SidebarNavItemProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  compact?: boolean;
};

export function SidebarNavItem({ href, icon: Icon, label, compact = false }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] font-medium transition-all duration-200 ease-out",
        active
          ? "bg-primary/8 text-primary"
          : "text-text-secondary hover:bg-surface-elevated hover:text-text",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-line"
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary"
          style={{ boxShadow: "0 0 12px var(--primary-glow)" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-all duration-200 ease-out",
          active
            ? "text-primary"
            : "text-text-tertiary group-hover:text-text-secondary",
        )}
      />
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}
