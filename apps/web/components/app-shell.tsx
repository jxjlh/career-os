"use client";

import {
  Compass,
  Home,
  MapPin,
  Menu,
  Moon,
  MoreHorizontal,
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
      {/* Sidebar —— Floating Navigation，宽度自适应（compact/expanded） */}
      <SidebarNav />

      {/* main 容器：padding-left 跟随 sidebar base 宽度（非 hover） */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ paddingLeft: sw.contentPadding ? `${sw.contentPadding}px` : undefined }}
      >
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border-subtle/60 px-4">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:text-text md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
            <span className="font-display text-base font-bold text-primary-glow">✦</span>
            <span className="font-display text-sm font-bold tracking-tight text-text">CareerOS</span>
          </Link>

          {/* 搜索框 —— placeholder: Search your life... */}
          <button
            className="hidden h-9 flex-1 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface/40 px-3 text-[13px] text-text-tertiary transition-colors hover:border-border hover:text-text-secondary md:flex md:max-w-sm"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span>{t("dashboard.searchLife")}</span>
          </button>

          {/* 右侧 —— 极简 icon */}
          <div className="ml-auto flex items-center gap-1">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:text-text"
              onClick={() => setCommandOpen(true)}
              aria-label="Command palette"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationBell />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:text-text"
              onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
              aria-label={t("common.language")}
            >
              <Languages className="h-4 w-4" />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary transition-colors hover:text-text"
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

        <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 pb-32 sm:p-6 md:pb-32 lg:pb-8">
          <Breadcrumb />
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeStandard}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />

      {/* Mobile Floating Navigation —— 不贴边，居中浮动胶囊 */}
      <FloatingNav isActive={isActive} />
    </div>
  );
}

// ── Mobile Floating Navigation ──────────────────────────────────────
function FloatingNav({ isActive }: { isActive: (href: string) => boolean }) {
  const { t } = useI18n();
  const nav = t("nav") as unknown as Record<string, string>;

  const items = [
    { href: "/dashboard", icon: Home, key: "dashboard" },
    { href: "/life", icon: Compass, key: "life" },
    { href: "/life/map", icon: MapPin, key: "lifeMap" },
  ];

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-subtle/80 bg-surface/90 px-2 py-2 shadow-soft backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {items.map(({ href, icon: Icon, key }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={nav[key] || key}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out",
              active
                ? "bg-primary/15 text-primary-glow shadow-[0_0_16px_-4px_var(--primary-glow)]"
                : "text-text-tertiary hover:text-text hover:bg-surface-elevated/60",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
      <Link
        href="/settings"
        aria-label={nav.settings}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ease-out",
          isActive("/settings")
            ? "bg-primary/15 text-primary-glow"
            : "text-text-tertiary hover:text-text hover:bg-surface-elevated/60",
        )}
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </Link>
    </nav>
  );
}

// ── Mobile Nav Sheet —— 从顶部展开的完整导航 ──────────────────────────
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
      label: nav.now || "NOW",
      items: [
        { href: "/dashboard", key: "dashboard" },
        { href: "/life", key: "life" },
        { href: "/life/map", key: "lifeMap" },
        { href: "/life/records", key: "lifeRecords" },
      ],
    },
    {
      label: nav.grow || "GROW",
      items: [
        { href: "/skills", key: "skills" },
        { href: "/planner", key: "planner" },
        { href: "/explore", key: "explore" },
        { href: "/library", key: "library" },
        { href: "/projects", key: "projects" },
      ],
    },
    {
      label: nav.careerGroup || "CAREER",
      items: [
        { href: "/resume", key: "resume" },
        { href: "/interviews", key: "interviews" },
        { href: "/jobs", key: "jobs" },
        { href: "/salary", key: "salary" },
        { href: "/analytics", key: "analytics" },
      ],
    },
  ];

  return (
    <div className="glass fixed inset-x-0 top-16 z-20 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-border-subtle/60 p-4 md:hidden">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
          MENU
        </span>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-surface-elevated hover:text-text"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-2 pb-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              {g.label}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "rounded-[10px] px-3 py-2.5 text-[13px] transition-colors",
                    isActive(item.href)
                      ? "bg-primary/8 text-text"
                      : "text-text-secondary hover:bg-surface-elevated/60 hover:text-text",
                  )}
                >
                  {nav[item.key] || item.key}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
