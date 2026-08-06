"use client";

import { ChevronLeft, Loader2, Play, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, type Word } from "@/lib/english";

const RATING_STYLES: Record<string, string> = {
  again: "bg-danger/90 hover:bg-danger text-white",
  hard: "bg-warning hover:bg-warning/90 text-white",
  good: "bg-primary hover:bg-primary-hover text-white",
  easy: "bg-success hover:bg-success/90 text-white",
};

const RATING_LABELS: Record<string, string> = {
  again: "陌生",
  hard: "吃力",
  good: "认识",
  easy: "简单",
};

function StudyContent() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId") || "";
  const [queue, setQueue] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const queueRef = useRef<Word[]>([]);

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    englishApi.getStudyQueue(bookId, 20)
      .then((res) => {
        setQueue(res.data);
        queueRef.current = res.data;
        setIndex(0);
        setShowAnswer(false);
      })
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, [bookId]);

  const currentWord = queue?.[index] ?? undefined;

  const handleRate = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentWord || reviewing) return;
    setReviewing(true);
    try {
      await englishApi.reviewWord(currentWord.id, rating);
      if (index + 1 < queueRef.current.length) {
        setIndex(index + 1);
        setShowAnswer(false);
      } else {
        const res = await englishApi.getStudyQueue(bookId, 20);
        setQueue(res.data);
        queueRef.current = res.data;
        setIndex(0);
        setShowAnswer(false);
      }
    } finally {
      setReviewing(false);
    }
  };

  const toggleStar = async () => {
    if (!currentWord) return;
    await englishApi.toggleStar(currentWord.id, !currentWord.isStarred);
    setQueue((prev): Word[] | null =>
      prev ? prev.map((w, i) => (i === index ? { ...w, isStarred: !w.isStarred } : w)) : prev,
    );
  };

  const playAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentWord) return;
    const url = englishApi.pronunciationUrl(currentWord.id);
    const audio = new Audio(url);
    audio.play().catch(() => {});
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载学习队列...
        </div>
      </div>
    );
  }

  if (!bookId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Link href="/english/words" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 返回词书
        </Link>
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-10 text-center">
          <h3 className="text-lg font-semibold">未选择词书</h3>
          <p className="max-w-sm text-sm text-muted">请先选择一本词书再开始学习。</p>
          <Link href="/english/words">
            <Button>选择词书</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!queue || queue.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Link href="/english/words" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 返回词书
        </Link>
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="text-4xl">🎉</div>
          <h3 className="text-lg font-semibold">今日学习已完成</h3>
          <p className="max-w-sm text-sm text-muted">
            暂无待复习或新学单词，明天再来打卡吧！或者切换到其他词书继续学习。
          </p>
          <Link href="/english/words">
            <Button>选择其他词书</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const word = queue[index]!;
  const progress = ((index + 1) / queue.length) * 100;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/english/words" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 词书列表
        </Link>
        <span className="text-xs font-medium text-text-tertiary">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card className="min-h-[320px] p-8">
        <div className="flex items-start justify-between">
          <button
            onClick={toggleStar}
            className={`rounded-full p-2 transition-colors ${
              word.isStarred ? "text-warning" : "text-text-tertiary hover:text-text"
            }`}
            aria-label="收藏"
          >
            <Star className={`h-5 w-5 ${word.isStarred ? "fill-current" : ""}`} />
          </button>
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
            {word.status === "new" ? "新词" : word.status === "learning" ? "学习中" : word.status}
          </span>
        </div>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-4xl font-bold tracking-tight">{word.spelling}</h2>
            <button
              onClick={playAudio}
              className="rounded-full bg-surface-elevated p-2 text-primary transition-colors hover:bg-primary hover:text-white"
              aria-label="发音"
            >
              <Play className="h-4 w-4 fill-current" />
            </button>
          </div>
          {word.phonetic && (
            <p className="mt-2 text-sm text-text-tertiary">{word.phonetic}</p>
          )}
          {word.pos && (
            <p className="mt-1 text-sm text-muted">{word.pos}</p>
          )}
        </div>

        <div className="mt-8">
          {!showAnswer ? (
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full rounded-[10px] border border-dashed border-border-subtle bg-surface/40 py-6 text-sm text-muted transition-colors hover:border-primary/40 hover:bg-surface-elevated"
            >
              点击显示释义
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-base leading-relaxed text-text">{word.meaning}</p>
              </div>
              {word.exampleEn && (
                <div className="rounded-[10px] bg-surface-muted/50 p-4">
                  <p className="text-sm italic text-text">{word.exampleEn}</p>
                  {word.exampleZh && (
                    <p className="mt-1 text-xs text-muted">{word.exampleZh}</p>
                  )}
                </div>
              )}
              {word.aiMnemonic && (
                <p className="text-xs leading-relaxed text-text-secondary">
                  💡 {word.aiMnemonic}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {showAnswer && (
        <div className="grid grid-cols-4 gap-2">
          {(["again", "hard", "good", "easy"] as const).map((r) => (
            <Button
              key={r}
              variant="ghost"
              disabled={reviewing}
              onClick={() => handleRate(r)}
              className={`h-14 text-sm font-semibold ${RATING_STYLES[r]}`}
            >
              {RATING_LABELS[r]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WordStudyPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-6"><div className="flex items-center justify-center py-24 text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载中...</div></div>}>
      <StudyContent />
    </Suspense>
  );
}
