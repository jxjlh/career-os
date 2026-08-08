"use client";

import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input } from "@/components/ui";
import { englishApi, type Word, type WordBook } from "@/lib/english";

const PAGE_SIZE = 500;

export default function WordCatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId") || "";
  const [book, setBook] = useState<WordBook | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedAll, setLoadedAll] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [bookResponse, wordsResponse] = await Promise.all([
          englishApi.getBook(bookId),
          englishApi.listWords(bookId, 0, PAGE_SIZE),
        ]);
        if (!cancelled) {
          setBook(bookResponse.data);
          setWords(wordsResponse.data);
          setLoadedAll(wordsResponse.data.length >= bookResponse.data.totalWords);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const loadAll = async () => {
    if (!book || loadedAll) return;
    setLoadingMore(true);
    try {
      const collected = [...words];
      while (collected.length < book.totalWords) {
        const response = await englishApi.listWords(book.id, collected.length, PAGE_SIZE);
        if (!response.data.length) break;
        collected.push(...response.data);
        setWords([...collected]);
        if (response.data.length < PAGE_SIZE) break;
      }
      setLoadedAll(collected.length >= book.totalWords);
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleWords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return words;
    return words.filter((word) => `${word.spelling} ${word.meaning} ${word.phonetic || ""}`.toLowerCase().includes(normalized));
  }, [query, words]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载完整词表…</div>;
  }

  if (!book) {
    return <div className="p-6 text-sm text-muted">词书不存在。</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => router.back()} className="mb-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ArrowLeft className="h-3 w-3" />返回词书</button>
          <h1 className="text-2xl font-bold">{book.name} · 完整词表</h1>
          <p className="mt-1 text-sm text-muted">已加载 {words.length} / {book.totalWords} 个单词，支持搜索和浏览完整内容。</p>
        </div>
        <Button onClick={loadAll} disabled={loadedAll || loadingMore}>{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loadedAll ? "已加载全部" : "加载完整词表"}</Button>
      </div>

      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词、音标或释义" /></div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[48px_minmax(110px,0.8fr)_minmax(100px,0.6fr)_minmax(180px,1.4fr)] gap-3 border-b border-border bg-surface-muted/50 px-4 py-3 text-xs font-semibold text-muted"><span>#</span><span>单词</span><span>词性/音标</span><span>释义</span></div>
        <div className="divide-y divide-border">
          {visibleWords.map((word) => <div key={word.id} className="grid grid-cols-[48px_minmax(110px,0.8fr)_minmax(100px,0.6fr)_minmax(180px,1.4fr)] gap-3 px-4 py-3 text-sm"><span className="text-xs text-muted">{words.indexOf(word) + 1}</span><span className="font-semibold">{word.spelling}</span><span className="text-xs text-muted">{[word.pos, word.phonetic].filter(Boolean).join(" · ") || "—"}</span><span className="text-text-secondary">{word.meaning || "—"}{word.exampleEn && <span className="mt-1 block text-xs text-muted">{word.exampleEn}</span>}</span></div>)}
          {visibleWords.length === 0 && <div className="p-8 text-center text-sm text-muted">没有匹配的单词。</div>}
        </div>
      </Card>
      {!loadedAll && <p className="text-center text-xs text-muted">点击“加载完整词表”后可继续查看剩余单词。</p>}
    </div>
  );
}
