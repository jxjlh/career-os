"use client";

import { BookOpen, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, type WordBook } from "@/lib/english";

export default function WordsPage() {
  const [books, setBooks] = useState<WordBook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    englishApi.listBooks()
      .then((res) => setBooks(res.data))
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  const startBook = async (bookId: string) => {
    setStartingId(bookId);
    try {
      await englishApi.startBook(bookId);
      setBooks((prev) =>
        prev?.map((b) => (b.id === bookId ? { ...b, progress: b.progress || 0 } : b)) ?? [],
      );
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">单词学习</h1>
        <p className="mt-1 text-sm text-muted">选择词书，开始今日学习任务</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载词书中...
        </div>
      )}

      {!loading && books && books.length === 0 && (
        <Card className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-8 text-center">
          <BookOpen className="h-8 w-8 text-muted" />
          <p className="font-semibold">暂无词书</p>
          <p className="max-w-sm text-sm text-muted">词库数据加载中，请稍候刷新页面</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {books?.map((book) => (
          <Card key={book.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{book.name}</h3>
                </div>
                <p className="mt-0.5 text-xs text-muted">{book.level}</p>
              </div>
              <span className="text-xs font-medium text-text-tertiary">
                {book.learnedCount}/{book.totalWords}
              </span>
            </div>

            {/* 进度条 */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${book.progress || 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              已掌握 {book.masteredCount} · 学习中 {book.learningCount} · 新词 {book.newCount}
            </p>

            <div className="mt-4 flex gap-2">
              <Link href={`/english/words/${book.id}`} className="flex-1">
                <Button className="w-full" variant="primary" size="sm">
                  开始学习 <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              {book.progress === 0 && book.totalWords > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={startingId === book.id}
                  onClick={() => startBook(book.id)}
                >
                  {startingId === book.id ? "初始化中..." : "启用此词书"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
