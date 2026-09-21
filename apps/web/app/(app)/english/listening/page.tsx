"use client";

import { Headphones, Loader2, Play, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import {
  DIFFICULTY_LABELS,
  englishApi,
  formatDuration,
  LISTENING_LEVELS,
  LISTENING_TOPICS,
  LISTENING_VOICES,
  type ListeningMaterial,
} from "@/lib/english";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-success/12 text-success",
  medium: "bg-warning/12 text-warning",
  hard: "bg-danger/12 text-danger",
};

const DIFFICULTY_OPTIONS: { key: "" | "easy" | "medium" | "hard"; label: string }[] = [
  { key: "", label: "自动" },
  { key: "easy", label: "简单" },
  { key: "medium", label: "中等" },
  { key: "hard", label: "困难" },
];

function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border text-text-secondary hover:border-primary/40 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function ListeningPage() {
  const [materials, setMaterials] = useState<ListeningMaterial[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [level, setLevel] = useState<string>("CET-4");
  const [topic, setTopic] = useState<string>("校园生活");
  const [difficulty, setDifficulty] = useState<"" | "easy" | "medium" | "hard">("");
  const [voice, setVoice] = useState<string>("catherine");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setLoading(true);
    const p = filter === "all" ? englishApi.listListening() : englishApi.listListening(undefined, filter);
    p.then((res) => setMaterials(res.data))
      .catch(() => setMaterials([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const res = await englishApi.generateListening({
        level,
        topic,
        difficulty: difficulty || undefined,
        voice,
      });
      const created = res.data;
      setMaterials((prev) => [created, ...(prev || [])]);
      setShowForm(false);
      const words = created.vocabulary || [];
      setNotice(
        words.length
          ? `已生成《${created.title}》，用上了你正在背的 ${words.length} 个词`
          : `已生成《${created.title}》`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  };

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">听力练习</h1>
          <p className="mt-1 text-sm text-muted">AI 按你正在背的词出材料 · TTS 朗读 · 答题测试</p>
        </div>
        <Button variant={showForm ? "ghost" : "primary"} size="sm" onClick={() => setShowForm((v) => !v)}>
          <Wand2 className="h-3.5 w-3.5" />
          {showForm ? "收起" : "生成新材料"}
        </Button>
      </div>

      {/* ── 生成面板 ── */}
      {showForm && (
        <Card className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              级别
            </p>
            <div className="flex flex-wrap gap-2">
              {LISTENING_LEVELS.map((lv) => (
                <Chip key={lv} active={level === lv} onClick={() => setLevel(lv)} disabled={generating}>
                  {lv}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              主题
            </p>
            <div className="flex flex-wrap gap-2">
              {LISTENING_TOPICS.map((tp) => (
                <Chip key={tp} active={topic === tp} onClick={() => setTopic(tp)} disabled={generating}>
                  {tp}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                难度
              </p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <Chip
                    key={d.key || "auto"}
                    active={difficulty === d.key}
                    onClick={() => setDifficulty(d.key)}
                    disabled={generating}
                  >
                    {d.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                发音人
              </p>
              <div className="flex flex-wrap gap-2">
                {LISTENING_VOICES.map((v) => (
                  <Chip key={v.key} active={voice === v.key} onClick={() => setVoice(v.key)} disabled={generating}>
                    {v.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? "正在生成原文与音频..." : "生成"}
            </Button>
            <span className="text-[11px] text-text-tertiary">
              会从你正在背的词书里挑词写进材料，通常需要 10-20 秒
            </span>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </Card>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-[10px] bg-success/10 px-3 py-2 text-xs text-success">
          <Sparkles className="h-3.5 w-3.5" />
          {notice}
        </div>
      )}

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
          <p className="font-semibold">还没有听力材料</p>
          <p className="max-w-sm text-sm text-muted">
            点「生成新材料」，AI 会按你的级别和正在背的词写一篇，并用 TTS 朗读出来
          </p>
          <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
            <Wand2 className="h-3.5 w-3.5" />
            生成第一篇
          </Button>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {materials?.map((m) => (
          <Link key={m.id} href={`/english/listening/detail?id=${m.id}`}>
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
                  {formatDuration(m.durationSeconds)}
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
