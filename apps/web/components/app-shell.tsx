"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  Images,
  Languages,
  Library,
  ListChecks,
  MapPin,
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
import { BrandMark } from "@/components/brand-mark";

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
      { key: "life", href: "/life", icon: Compass, group: "lifeGoals" },
      { key: "lifeMap", href: "/life/map", icon: MapPin, group: "lifeGoals" },
      { key: "lifeRecords", href: "/life/records", icon: Images, group: "lifeGoals" },
      { key: "skills", href: "/skills", icon: Target, group: "careerPlan" },
      { key: "planner", href: "/planner", icon: CalendarDays, group: "careerPlan" },
      { key: "library", href: "/library", icon: Library, group: "careerPlan" },
      { key: "projects", href: "/projects", icon: FolderKanban, group: "careerPlan" },
      { key: "interviews", href: "/interviews", icon: ListChecks, group: "careerPlan" },
      { key: "resume", href: "/resume", icon: GraduationCap, group: "careerPlan" },
      { key: "coach", href: "/coach", icon: Sparkles, group: "careerPlan" },
      { key: "explore", href: "/explore", icon: Search, group: "careerPlan" },
      { key: "jobs", href: "/jobs", icon: FileText, group: "careerPlan" },
      { key: "salary", href: "/salary", icon: Wallet, group: "careerPlan" },
      { key: "analytics", href: "/analytics", icon: BarChart3, group: "careerPlan" },
      { key: "settings", href: "/settings", icon: Settings, group: "system" },
    ],
    [],
  );

  const groups = useMemo(() => {
    const order = ["overview", "lifeGoals", "careerPlan", "system"];
    return order
      .map((group) => ({ group, items: nav.filter((item) => item.group === group) }))
      .filter((g) => g.items.length > 0);
  }, [nav]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border/70 lg:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark className="h-9 w-9" />
          <span className="text-[16px] font-bold tracking-tight">
            Career<span className="text-gradient">OS</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">
                {(t("nav") as unknown as Record<string, string>)[group]}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] transition-all",
                      isActive(item.href)
                        ? "bg-gradient-to-r from-primary/14 to-accent/10 font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(91,91,214,0.12)]"
                        : "text-muted hover:bg-surface-muted/70 hover:text-text",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-transform group-hover:scale-110",
                        isActive(item.href) ? "text-primary" : "",
                      )}
                    />
                    {(t("nav") as unknown as Record<string, string>)[item.key]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border/70 p-3">
          <div className="flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-primary/8 to-accent/8 p-2.5 text-[13px] text-muted">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Free plan</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/70 px-4">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-surface-muted lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <BrandMark className="h-8 w-8" />
            <span className="text-sm font-bold tracking-tight">
              Career<span className="text-gradient">OS</span>
            </span>
          </Link>
          <div className="hidden flex-1 items-center gap-2 rounded-[10px] border border-border/70 bg-surface/70 px-3 py-2 text-[13px] text-muted shadow-[0_1px_2px_rgba(23,21,31,0.04)] lg:flex lg:max-w-md">
            <Search className="h-4 w-4" />
            <span>{t("common.search")}...</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="hidden h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-surface-muted hover:text-primary lg:flex"
              onClick={() => setCommandOpen(true)}
              aria-label="Command palette"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-surface-muted hover:text-primary"
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              aria-label={t("common.language")}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted transition-colors hover:bg-surface-muted hover:text-primary"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={t("common.theme")}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary via-[#7a5cd6] to-accent text-xs font-bold text-white shadow-[0_8px_18px_-8px_rgba(91,91,214,0.7)]">
              U
            </div>
          </div>
        </header>

        {mobileOpen && (
          <div className="glass fixed inset-x-0 top-16 z-20 border-b border-border/70 p-3 lg:hidden">
            {groups.map(({ group, items }) => (
              <div key={group} className="mb-2">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  {(t("nav") as unknown as Record<string, string>)[group]}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-[10px] px-2 py-2 text-[13px]",
                        isActive(item.href) ? "bg-primary/12 font-medium text-primary" : "text-muted",
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
          { href: "/life", icon: Compass },
          { href: "/coach", icon: Sparkles },
          { href: "/settings", icon: Settings },
        ].map(({ href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium",
              isActive(href)
                ? "text-primary"
                : "text-muted hover:text-text",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                isActive(href) ? "bg-gradient-to-r from-primary/14 to-accent/12" : "",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            {(t("nav") as unknown as Record<string, string>)[href.replace("/", "")] || ""}
          </Link>
        ))}
      </nav>
    </div>
  );
}
