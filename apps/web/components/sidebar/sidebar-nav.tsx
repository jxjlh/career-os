"use client";

import {
  BookOpen,
  CalendarDays,
  Compass,
  FolderKanban,
  Home,
  Images,
  Library,
  MapPin,
  Search,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarProfile } from "./sidebar-profile";
import { useSidebarWidth } from "./use-sidebar-width";

type NavItem = {
  key: string;
  href: string;
  icon: React.ElementType;
  group: "now" | "grow" | "career";
};

type GroupKey = "now" | "grow" | "career";

/** 路由 → NOW/GROW 分组映射（CAREER 分组已移除，保留路由但不展示在侧边栏） */
const NAV: NavItem[] = [
  // NOW —— 当下
  { key: "dashboard", href: "/dashboard", icon: Home, group: "now" },
  { key: "life", href: "/life", icon: Compass, group: "now" },
  { key: "lifeMap", href: "/life/map", icon: MapPin, group: "now" },
  { key: "lifeRecords", href: "/life/records", icon: Images, group: "now" },
  // GROW —— 成长
  { key: "skills", href: "/skills", icon: Target, group: "grow" },
  { key: "planner", href: "/planner", icon: CalendarDays, group: "grow" },
  { key: "coach", href: "/coach", icon: Sparkles, group: "grow" },
  { key: "explore", href: "/explore", icon: Search, group: "grow" },
  { key: "library", href: "/library", icon: Library, group: "grow" },
  { key: "projects", href: "/projects", icon: FolderKanban, group: "grow" },
];

const GROUP_ORDER: GroupKey[] = ["now", "grow"];

export function SidebarNav() {
  const { t } = useI18n();
  const sw = useSidebarWidth();

  const groups = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      items: NAV.filter((n) => n.group === g),
    }));
  }, []);

  // mobile 不渲染（用 BottomNav）
  if (!sw.visible) return null;

  const groupLabel = (g: GroupKey): string => {
    const map: Record<GroupKey, string> = { now: "NOW", grow: "GROW", career: "CAREER" };
    return (t("nav") as unknown as Record<string, string>)[g] || map[g];
  };

  return (
    <aside
      onMouseEnter={sw.onEnter}
      onMouseLeave={sw.onLeave}
      style={{ width: sw.width }}
      className={cn(
        "glass fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border-subtle/60",
        "transition-[width] duration-200 ease-out",
      )}
    >
      {/* Logo 区 —— ✦ CareerOS + YOUR LIFE OS */}
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
        <span className="font-display text-lg font-bold text-primary-glow">✦</span>
        {!sw.isCompact && (
          <div className="leading-none">
            <span className="font-display text-[15px] font-bold tracking-tight text-text">
              CareerOS
            </span>
            <p className="mt-1 font-display text-[9px] font-medium uppercase tracking-[0.2em] text-text-tertiary">
              YOUR LIFE OS
            </p>
          </div>
        )}
      </Link>

      {/* 导航分组 */}
      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-none">
        {groups.map(({ group, items }) => (
          <div key={group}>
            {!sw.isCompact && (
              <p className="px-3 pb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                {groupLabel(group)}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={(t("nav") as unknown as Record<string, string>)[item.key] || item.key}
                  compact={sw.isCompact}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer：Profile + Settings */}
      <div className="border-t border-border-subtle/60">
        <SidebarProfile compact={sw.isCompact} />
        <Link
          href="/settings"
          title={sw.isCompact ? (t("nav") as unknown as Record<string, string>).settings : undefined}
          className={cn(
            "group flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-200 ease-out",
            "mx-3 mb-3 text-text-secondary hover:bg-surface-elevated/60 hover:text-text",
          )}
        >
          <Settings className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-45" />
          {!sw.isCompact && <span>{(t("nav") as unknown as Record<string, string>).settings}</span>}
        </Link>
      </div>
    </aside>
  );
}

// 保持向后兼容 —— 旧 BookOpen 引用（如有）
export { BookOpen };
