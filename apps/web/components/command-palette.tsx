"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const LINKS = [
  ["/dashboard", "nav.dashboard"],
  ["/roadmap", "nav.roadmap"],
  ["/skills", "nav.skills"],
  ["/explore", "nav.explore"],
  ["/planner", "nav.planner"],
  ["/coach", "nav.coach"],
  ["/jobs", "nav.jobs"],
  ["/resume", "nav.resume"],
] as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const items = LINKS.filter(([, key]) => {
    const label = t(key);
    return label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6 pt-24"
      onClick={onClose}
    >
      <Card className="w-full max-w-xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            className="pl-9"
            placeholder={`${t("common.search")}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-3 space-y-1">
          {items.map(([href, key]) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center justify-between rounded-[6px] px-3 py-2 text-sm hover:bg-surface-muted"
            >
              <span>{t(key)}</span>
              <span className="text-xs text-muted">↩</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Esc
          </Button>
        </div>
      </Card>
    </div>
  );
}
