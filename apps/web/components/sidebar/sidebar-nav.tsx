"use client";

import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  FolderKanban,
  Home,
  Images,
  Library,
  WalletCards,
  MapPin,
  NotebookPen,
  Search,
  Settings,
  Target,
  TrendingUp,
  Users,
  FileText,
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
  icon: React.ElementType | null;
  group: "now" | "career" | "grow" | "ai";
};

type GroupKey = "now" | "career" | "grow" | "ai";

const NAV: NavItem[] = [
  // 我的生活
  { key: "dashboard", href: "/dashboard", icon: Home, group: "now" },
  { key: "life", href: "/life", icon: Compass, group: "now" },
  { key: "lifeMap", href: "/life/map", icon: MapPin, group: "now" },
  { key: "lifeRecords", href: "/life/records", icon: Images, group: "now" },
  { key: "journal", href: "/journal", icon: NotebookPen, group: "now" },
  { key: "contacts", href: "/contacts", icon: Users, group: "now" },
  // 我的职业
  { key: "career", href: "/career", icon: Briefcase, group: "career" },
  { key: "resume", href: "/resume", icon: FileText, group: "career" },
  { key: "interviews", href: "/interviews", icon: Users, group: "career" },
  { key: "jobs", href: "/jobs", icon: Search, group: "career" },
  { key: "salary", href: "/salary", icon: WalletCards, group: "career" },
  { key: "analytics", href: "/analytics", icon: TrendingUp, group: "career" },
  // 我的成长
  { key: "skills", href: "/skills", icon: Target, group: "grow" },
  { key: "planner", href: "/planner", icon: CalendarDays, group: "grow" },
  { key: "explore", href: "/explore", icon: Search, group: "grow" },
  { key: "library", href: "/library", icon: Library, group: "grow" },
  { key: "projects", href: "/projects", icon: FolderKanban, group: "grow" },
  { key: "english", href: "/english", icon: BookOpen, group: "grow" },
  { key: "finance", href: "/finance", icon: WalletCards, group: "grow" },
  // ✦ AI
  { key: "aiCompanion", href: "/journal/companion", icon: null, group: "ai" },
];

const GROUP_ORDER: GroupKey[] = ["now", "career", "grow", "ai"];

export function SidebarNav() {
  const { t } = useI18n();
  const sw = useSidebarWidth();

  const groups = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      items: NAV.filter((n) => n.group === g),
    }));
  }, []);

  if (!sw.visible) return null;

  const groupLabel = (g: GroupKey): string => {
    const map: Record<GroupKey, string> = {
      now: "我的生活",
      grow: "我的成长",
      career: "我的职业",
      ai: "AI",
    };
    return (t("nav") as unknown as Record<string, string>)[g] || map[g];
  };

  return (
    <aside
      onMouseEnter={sw.onEnter}
      onMouseLeave={sw.onLeave}
      style={{ width: sw.width }}
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border/60 bg-white",
        "transition-[width] duration-200 ease-out",
      )}
    >
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-white">
          C
        </span>
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

      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-none">
        {groups.map(({ group, items }) => (
          <div key={group}>
            {!sw.isCompact && (
              <p className="px-2.5 pb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary/80">
                {group === "ai" ? (
                  <span className="flex items-center gap-1">
                    <span className="ai-star">✦</span>
                    {groupLabel(group)}
                  </span>
                ) : (
                  groupLabel(group)
                )}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={
                    group === "ai"
                      ? "AI 陪伴"
                      : (t("nav") as unknown as Record<string, string>)[item.key] || item.key
                  }
                  compact={sw.isCompact}
                  isAI={group === "ai"}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/60">
        <SidebarProfile compact={sw.isCompact} />
        <Link
          href="/settings"
          title={sw.isCompact ? (t("nav") as unknown as Record<string, string>).settings : undefined}
          className={cn(
            "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] font-medium transition-colors duration-200 ease-out",
            "mx-2.5 mb-3 text-text-secondary hover:bg-surface-elevated hover:text-text",
          )}
        >
          <Settings className="h-[19px] w-[19px] shrink-0 transition-transform group-hover:rotate-45" />
          {!sw.isCompact && <span>{(t("nav") as unknown as Record<string, string>).settings}</span>}
        </Link>
      </div>
    </aside>
  );
}

export { BookOpen };
