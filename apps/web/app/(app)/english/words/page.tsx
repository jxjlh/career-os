"use client";

import { BookOpen, ChevronRight, Flame, GraduationCap, Loader2, Calendar, Target, RotateCcw, AlertTriangle, List } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, type WordBook, type WeeklyPlan } from "@/lib/english";

export default function WordsPage() {
  const router = useRouter();
  const [books, setBooks] = useState<WordBook[] | null>(null);
  const [weeklyPlans, setWeeklyPlans] = useState<Map<string, WeeklyPlan>>(new Map());
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const booksRes = await englishApi.listBooks();
        const booksData = booksRes.data;
        setBooks(booksData);

        // 只加载前 5 本有进度的词书的周计划，其余按需加载
        const booksWithProgress = booksData.filter((b) => b.learnedCount > 0).slice(0, 5);

        if (booksWithProgress.length > 0) {
          const planPromises = booksWithProgress.map(async (b) => {
            try {
              const planRes = await englishApi.getWeeklyPlan(b.id);
              return [b.id, planRes.data] as const;
            } catch {
              return [b.id, null] as const;
            }
          });

          const results = await Promise.all(planPromises);
          const newPlans = new Map<string, WeeklyPlan>();
          results.forEach(([id, plan]) => {
            if (plan) newPlans.set(id, plan);
          });
          setWeeklyPlans(newPlans);
        }
      } catch {
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const startBook = async (bookId: string) => {
    setStartingId(bookId);
    try {
      await englishApi.startBook(bookId);
      // 乐观更新：直接跳转到学习页面，不等周计划加载
      setBooks((prev) =>
        prev?.map((b) => (b.id === bookId ? { ...b, progress: b.progress || 0 } : b)) ?? [],
      );
      // 后台异步加载周计划
      englishApi.getWeeklyPlan(bookId).then((planRes) => {
        setWeeklyPlans((prev) => {
          const next = new Map(prev);
          next.set(bookId, planRes.data);
          return next;
        });
      }).catch(() => {});
    } finally {
      setStartingId(null);
    }
  };

  const getWeekDayName = () => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[new Date().getDay()];
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">单词学习</h1>
        <p className="mt-1 text-sm text-muted">选择词书，按周计划科学学习</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {books?.map((book) => {
          const plan = weeklyPlans.get(book.id);
          const hasProgress = book.learnedCount > 0;

          return (
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

              {/* 周计划信息 */}
              {plan && hasProgress && (
                <div className="mt-4 space-y-2 rounded-[10px] bg-surface-muted/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-primary">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-medium">今日任务 · {getWeekDayName()}</span>
                    </div>
                    {plan.isSunday && (
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning">
                        周复习日
                      </span>
                    )}
                  </div>

                  {/* 今日任务列表 */}
                  <div className="grid grid-cols-3 gap-2">
                    {!plan.isSunday && plan.todayTask.newWords > 0 && (
                      <div className="flex flex-col items-center rounded-lg bg-primary/10 p-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="mt-1 text-sm font-bold">{plan.todayTask.newWords}</span>
                        <span className="text-[10px] text-text-tertiary">新词</span>
                      </div>
                    )}
                    {plan.todayTask.reviewWords > 0 && (
                      <div className="flex flex-col items-center rounded-lg bg-accent/10 p-2">
                        <RotateCcw className="h-4 w-4 text-accent" />
                        <span className="mt-1 text-sm font-bold">{plan.todayTask.reviewWords}</span>
                        <span className="text-[10px] text-text-tertiary">复习</span>
                      </div>
                    )}
                    {plan.againCount > 0 && (
                      <div className="flex flex-col items-center rounded-lg bg-danger/10 p-2">
                        <AlertTriangle className="h-4 w-4 text-danger" />
                        <span className="mt-1 text-sm font-bold">{plan.againCount}</span>
                        <span className="text-[10px] text-text-tertiary">需加强</span>
                      </div>
                    )}
                  </div>

                  {/* 周计划进度 */}
                  <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                    <span>剩余 {plan.weekDaysRemaining} 天</span>
                    <span>每日目标 {plan.dailyNewWords} 词</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  className="flex-1"
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/english/words/study?bookId=${book.id}`)}
                >
                  {hasProgress ? '继续学习' : '开始学习'} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  title="查看完整词表"
                  onClick={() => router.push(`/english/words/catalog?bookId=${book.id}`)}
                >
                  <List className="h-3.5 w-3.5" />
                  完整词表
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 学习提示 */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Flame className="h-4 w-4 text-warning" />
          周计划学习规则
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">•</span>
            <span>每天学习指定数量的新词（根据词书难度自动调整）</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">•</span>
            <span>系统会自动安排到期复习单词，巩固记忆</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-danger">•</span>
            <span>评分&quot;陌生&quot;的单词会立即加入复习队列，确保掌握</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-warning">•</span>
            <span>周日为周复习日，集中复习本周学过的所有单词</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
