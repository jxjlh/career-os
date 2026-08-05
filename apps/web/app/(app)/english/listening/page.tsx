"use client";

import { Headphones, Loader2, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, type ListeningMaterial } from "@/lib/english";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-success/12 text-success",
  medium: "bg-warning/12 text-warning",
  hard: "bg-danger/12 text-danger",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

export default function ListeningPage() {
  const [materials, setMaterials] = useState<ListeningMaterial[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    const p = filter === "all" ? englishApi.listListening() : englishApi.listListening(undefined, filter);
    p.then((res) => setMaterials(res.data))
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载听力材料...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">听力练习</h1>
        <p className="mt-1 text-sm text-muted">AI 生成材料 · TTS 朗读 · 答题测试</p>
      </div>

      {/* 难度筛选 */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "全部" },
          { key: "easy", label: "简单" },
          { key: "medium", label: "中等" },
          { key: "hard", label: "困难" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {materials && materials.length === 0 && (
        <Card className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-8 text-center">
          <Headphones className="h-8 w-8 text-muted" />
          <p className="font-semibold">暂无听力材料</p>
          <p className="max-w-sm text-sm text-muted">AI 听力材料将在后续版本上线</p>
          <div className="mt-4 flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> 即将推出
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {materials?.map((m) => (
          <Link key={m.id} href={`/english/listening/${m.id}`}>
            <Card className="cursor-pointer p-5 transition-all hover:border-primary/40 hover:bg-surface-elevated">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-accent" />
                    <h3 className="font-semibold leading-tight">{m.title}</h3>
                  </div>
                  {m.transcript && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                      {m.transcript}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLES[m.difficulty]}`}>
                  {DIFFICULTY_LABELS[m.difficulty]}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {m.durationSeconds ? `${Math.round(m.durationSeconds / 60)}:${String(m.durationSeconds % 60).padStart(2, "0")}` : "--:--"}
                </span>
                {m.attempted && <span className="text-success">已练习</span>}
                {m.isAiGenerated && (
                  <span className="flex items-center gap-0.5 text-ai">
                    <Sparkles className="h-3 w-3" /> AI
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
