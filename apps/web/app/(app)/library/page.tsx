"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function LibraryPage() {
  const { t } = useI18n();
  const bookmarks = useQuery<Envelope>({
    queryKey: ["bookmarks"],
    queryFn: () => apiFetch("/library/bookmarks"),
  });

  const items = bookmarks.data?.data || [];

  return (
    <div>
      <SectionHeader title={t("nav.library")} />
      {items.length === 0 ? (
        <EmptyState
          title="Bookmarks"
          description={t("library.noBookmarks")}
          action={
            <a href="/explore">
              <Button>
                <Search className="h-4 w-4" />
                {t("common.search")}
              </Button>
            </a>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <Card key={item.bookmarkId} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary">
                  {item.title}
                </a>
                {item.note && <p className="mt-0.5 text-[13px] text-muted">{item.note}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.tags.map((tag: any) => (
                    <Badge key={tag.id}>{tag.name}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
