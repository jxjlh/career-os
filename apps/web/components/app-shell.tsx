"use client";

import {
  Compass,
  Home,
  MapPin,
  Menu,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Search,
  Sun,
  Languages,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

import { useI18n } from "@/lib/i18n";
import { easeStandard } from "@/lib/motion";
import { cn } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { SidebarNav, useSidebarWidth } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const sw = useSidebarWidth();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const nav = t("nav") as unknown as Record<string, string>;

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav />

      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ paddingLeft: sw.contentPadding ? `${sw.contentPadding}px` : undefined }}
      >
        <header
          className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle/80 px-4"
          style={{
            height: "calc(4rem + env(safe-area-inset-top))",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <button
            className="-ml-1.5 flex h-11 w-11 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary text-sm font-bold text-white">
              C
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-text">CareerOS</span>
          </Link>

          <button
            className="hidden h-9 flex-1 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface px-3 text-[13px] text-text-tertiary transition-colors hover:border-border hover:text-text-secondary md:flex md:max-w-sm"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span>{t("dashboard.searchLife")}</span>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
              onClick={() => setCommandOpen(true)}
              aria-label="Command palette"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <button
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              aria-label={t("common.language")}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={t("common.theme")}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="ml-1">
              <UserMenu />
            </div>
          </div>
        </header>

        {mobileOpen && <MobileNavSheet onClose={() => setMobileOpen(false)} isActive={isActive} />}

        <main className="relative mx-auto w-full max-w-[1100px] flex-1 p-4 pb-40 sm:p-6 md:pb-32 lg:pb-8">
          <Breadcrumb />
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeStandard}
          >
            {children}
          </motion.div>
          {/* 移动端底部渐变遮罩：提示下方有内容，避免 FixedNav 突然遮挡的突兀感 */}
          <div
            aria-hidden
            className="pointer-events-none sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mt-16 h-16 bg-gradient-to-b from-transparent to-background md:hidden"
          />
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      <FloatingNav isActive={isActive} />
    </div>
  );
}

function FloatingNav({ isActive }: { isActive: (href: string) => boolean }) {
  const { t } = useI18n();
  const nav = t("nav") as unknown as Record<string, string>;

  const items = [
    { href: "/dashboard", icon: Home, key: "dashboard" },
    { href: "/journal", icon: NotebookPen, key: "journal" },
    { href: "/journal/companion", icon: null, key: "aiCompanion", isAI: true },
    { href: "/settings", icon: MoreHorizontal, key: "settings" },
  ];

  return (
    <nav
      className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-subtle bg-surface/90 px-3 py-2 shadow-soft backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {items.map(({ href, icon: Icon, key, isAI }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={nav[key] || key}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ease-out",
              active
                ? "bg-primary/15 text-primary shadow-[0_0_16px_-4px_var(--primary-glow)]"
                : "text-text-tertiary hover:text-text hover:bg-surface-elevated",
            )}
          >
            {isAI ? (
              <span className="text-[18px] leading-none">✦</span>
            ) : (
              Icon && <Icon className="h-[18px] w-[18px]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavSheet({
  onClose,
  isActive,
}: {
  onClose: () => void;
  isActive: (href: string) => boolean;
}) {
  const { t } = useI18n();
  const nav = t("nav") as unknown as Record<string, string>;

  const groups: Array<{ label: string; items: Array<{ href: string; key: string }> }> = [
    {
      label: nav.now || "我的生活",
      items: [
        { href: "/dashboard", key: "dashboard" },
        { href: "/life", key: "life" },
        { href: "/life/map", key: "lifeMap" },
        { href: "/life/records", key: "lifeRecords" },
        { href: "/journal", key: "journal" },
        { href: "/contacts", key: "contacts" },
      ],
    },
    {
      label: nav.careerGroup || "我的职业",
      items: [
        { href: "/career", key: "career" },
        { href: "/resume", key: "resume" },
        { href: "/interviews", key: "interviews" },
        { href: "/jobs", key: "jobs" },
        { href: "/salary", key: "salary" },
        { href: "/analytics", key: "analytics" },
      ],
    },
    {
      label: nav.grow || "我的成长",
      items: [
        { href: "/skills", key: "skills" },
        { href: "/planner", key: "planner" },
        { href: "/explore", key: "explore" },
        { href: "/library", key: "library" },
        { href: "/projects", key: "projects" },
        { href: "/english", key: "english" },
        { href: "/finance", key: "finance" },
      ],
    },
    {
      label: "✦ AI",
      items: [
        { href: "/journal/companion", key: "aiCompanion" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 md:hidden"
      style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          MENU
        </span>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-text-tertiary hover:bg-surface-elevated hover:text-text"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-2 pb-2 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              {g.label}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex min-h-12 items-center rounded-[12px] px-4 py-2.5 text-[15px] leading-5 transition-colors",
                    isActive(item.href)
                      ? "bg-primary/12 text-primary font-medium"
                      : "text-text-secondary hover:bg-surface-elevated hover:text-text",
                  )}
                >
                  {item.key === "aiCompanion" ? "AI 陪伴" : (nav[item.key] || item.key)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
