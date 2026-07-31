"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bookmark, ExternalLink, Loader2, Play, Search } from "lucide-react";
import { useState } from "react";

import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function ExplorePage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const providers = useQuery<Envelope>({
    queryKey: ["explore-providers"],
    queryFn: () => apiFetch("/explore/providers"),
  });

  const search = useMutation({
    mutationFn: async (q: string) => {
      setSearching(true);
      const res = await apiFetch<Envelope>("/explore/search", {
        method: "POST",
        body: JSON.stringify({ query: q, limit: 12 }),
      });
      const jobId = res.data.jobId;
      for (let i = 0; i < 30; i += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const job = await apiFetch<Envelope>(`/explore/jobs/${jobId}`);
        if (job.data.status === "succeeded") {
          setResult(job.data.result.items || []);
          setSearching(false);
          return;
        }
        if (job.data.status === "failed") break;
      }
      setSearching(false);
    },
  });

  return (
    <div>
      <SectionHeader title={t("explore.title")} subtitle="AI Learning Search Engine" />
      <Card className="p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) search.mutate(query.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder={t("explore.placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={searching || !query.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("common.search")}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t("explore.providers")}:</span>
          {(providers.data?.data || []).map((p: any) => (
            <Badge key={p.name}>{p.name}</Badge>
          ))}
        </div>
      </Card>

      {searching && (
        <Card className="mt-4 flex items-center gap-3 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted">Searching across the web...</span>
        </Card>
      )}

      {result && (
        <div className="mt-4 space-y-2">
          {result.map((item, i) => (
            <Card key={i} className="flex gap-3 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-surface-muted">
                {item.resourceType === "video" ? (
                  <Play className="h-4 w-4 text-ai" />
                ) : (
                  <Search className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {item.isOfficial && <Badge variant="primary">Official</Badge>}
                  {item.isFree && <Badge variant="success">Free</Badge>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{item.snippet || item.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{item.sourceName || item.provider}</span>
                  <span>{item.difficulty}</span>
                  {item.durationMinutes && <span>{item.durationMinutes} {t("explore.minutes")}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <Button variant="ghost" size="icon" aria-label={t("explore.save")}>
                  <Bookmark className="h-4 w-4" />
                </Button>
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    {t("explore.open")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
