"use client";

import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  FileText,
  GraduationCap,
  Home,
  Languages,
  Library,
  ListChecks,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Wallet,
  Workflow,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = {
  key: string;
  href: string;
  icon: React.ElementType;
  group: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const nav: NavItem[] = useMemo(
    () => [
      { key: "dashboard", href: "/dashboard", icon: Home, group: "overview" },
      { key: "life", href: "/life", icon: Compass, group: "overview" },
      { key: "roadmap", href: "/roadmap", icon: Workflow, group: "growth" },
      { key: "skills", href: "/skills", icon: Target, group: "growth" },
      { key: "planner", href: "/planner", icon: CalendarDays, group: "growth" },
      { key: "analytics", href: "/analytics", icon: BarChart3, group: "growth" },
      { key: "explore", href: "/explore", icon: Search, group: "learning" },
      { key: "library", href: "/library", icon: Library, group: "learning" },
      { key: "projects", href: "/projects", icon: Briefcase, group: "career" },
      { key: "interviews", href: "/interviews", icon: ListChecks, group: "career" },
      { key: "jobs", href: "/jobs", icon: FileText, group: "career" },
      { key: "salary", href: "/salary", icon: Wallet, group: "career" },
      { key: "resume", href: "/resume", icon: GraduationCap, group: "career" },
      { key: "coach", href: "/coach", icon: Sparkles, group: "ai" },
      { key: "settings", href: "/settings", icon: Settings, group: "system" },
    ],
    [],
  );

  const groups = useMemo(() => {
    const order = ["overview", "growth", "learning", "career", "ai", "system"];
    return order
      .map((group) => ({ group, items: nav.filter((item) => item.group === group) }))
      .filter((g) => g.items.length > 0);
  }, [nav]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <Link href="/dashboard" className="flex h-14 items-center gap-2 px-4">
          <img src="/icons/career-os-appicon.png" alt="Career OS" className="h-8 w-8 rounded-[8px]" />
          <span className="text-[15px] font-bold">Career OS</span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {(t("nav") as unknown as Record<string, string>)[group]}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[6px] px-2 py-2 text-[13px] transition-colors",
                      isActive(item.href)
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted hover:bg-surface-muted hover:text-text",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {(t("nav") as unknown as Record<string, string>)[item.key]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-[6px] p-2 text-[13px] text-muted">
            <BookOpen className="h-4 w-4" />
            <span>Free plan</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <img src="/icons/career-os-appicon.png" alt="Career OS" className="h-7 w-7 rounded-[6px]" />
            <span className="text-sm font-bold">Career OS</span>
          </Link>
          <div className="hidden flex-1 items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2 text-[13px] text-muted lg:flex lg:max-w-md">
            <Search className="h-4 w-4" />
            <span>{t("common.search")}...</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted lg:flex"
              onClick={() => setCommandOpen(true)}
              aria-label="Command palette"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted"
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              aria-label={t("common.language")}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[6px] text-muted hover:bg-surface-muted"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={t("common.theme")}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              U
            </div>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-x-0 top-14 z-20 border-b border-border bg-surface p-3 lg:hidden">
            {groups.map(({ group, items }) => (
              <div key={group} className="mb-2">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase text-muted">
                  {(t("nav") as unknown as Record<string, string>)[group]}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-[6px] px-2 py-2 text-[13px]",
                        isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {(t("nav") as unknown as Record<string, string>)[item.key]}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 pb-24 sm:p-6 lg:pb-8">
          <Breadcrumb />
          {children}
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        {[
          { href: "/dashboard", icon: Home },
          { href: "/explore", icon: Search },
          { href: "/coach", icon: Sparkles },
          { href: "/jobs", icon: Briefcase },
          { href: "/settings", icon: Settings },
        ].map(({ href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-[10px]",
              isActive(href) ? "text-primary" : "text-muted",
            )}
          >
            <Icon className="h-5 w-5" />
            {(t("nav") as unknown as Record<string, string>)[href.replace("/", "")] || ""}
          </Link>
        ))}
      </nav>
    </div>
  );
}
