"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useI18n } from "@/lib/i18n";

export function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useI18n();
  const segments = useMemo(
    () =>
      pathname
        .split("/")
        .filter(Boolean)
        .map((segment, index, all) => ({
          label: (t("nav") as unknown as Record<string, string>)[segment] || segment,
          href: `/${all.slice(0, index + 1).join("/")}`,
        })),
    [pathname, t],
  );

  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-0.5 overflow-x-auto text-[13px] text-muted md:mb-3">
      <Link href="/dashboard" className="flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-md px-1.5 transition-colors hover:bg-surface-elevated/60 hover:text-text">
        {t("nav.dashboard")}
      </Link>
      {segments.map((segment) => (
        <span key={segment.href} className="flex shrink-0 items-center gap-0.5">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link href={segment.href} className="flex min-h-8 items-center whitespace-nowrap rounded-md px-1.5 capitalize transition-colors hover:bg-surface-elevated/60 hover:text-text">
            {segment.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
