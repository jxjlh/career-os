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
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-[13px] text-muted">
      <Link href="/dashboard" className="hover:text-text">
        {t("nav.dashboard")}
      </Link>
      {segments.map((segment) => (
        <span key={segment.href} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={segment.href} className="capitalize hover:text-text">
            {segment.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
