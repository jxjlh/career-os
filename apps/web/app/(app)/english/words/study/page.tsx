"use client";

import {
  ChevronLeft,
  Loader2,
  Star,
  Volume2,
  PenLine,
  Card as CardIcon,
  Check,
  X,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { Button, Card } from "@/components/ui";
import { englishApi, speak, type Word } from "@/lib/english";

type StudyMode = "card" | "dictation";
type DictationStep = "listen" | "typing" | "result";

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

const RATING_KEYS: Record<string, string> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

/** 所有需要重置的默写状态打包成一个对象，避免多次 setState */
interface DictationState {
  step: DictationStep;
  input: string;
  result: "correct" | "wrong" | null;
  sentenceInput: string;
  sentenceCompare: boolean;
}

const INITIAL_DICTATION: DictationState = {
  step: "listen",
  input: "",
  result: null,
  sentenceInput: "",
  sentenceCompare: false,
};

function StudyContent() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("bookId") || "";
  const [queue, setQueue] = useState<Word[] | null>(null);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const queueRef = useRef<Word[]>([]);

  const [mode, setMode] = useState<StudyMode>("card");
  const [dict, setDict] = useState<DictationState>(INITIAL_DICTATION);

  const inputRef = useRef<HTMLInputElement>(null);
  const sentenceInputRef = useRef<HTMLTextAreaElement>(null);

  const currentWord = queue?.[index] ?? undefined;

  // 初始加载
  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    englishApi
      .startBook(bookId)
      .then(() => englishApi.getStudyQueue(bookId, 20))
      .then((res) => {
        setQueue(res.data);
        queueRef.current = res.data;
        setIndex(0);
        setShowAnswer(false);
        setDict(INITIAL_DICTATION);
      })
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, [bookId]);

  // 单词切换时：用 microtask 分离语音播放和状态重置
  useEffect(() => {
    if (!currentWord || loading) return;
    speak(currentWord.spelling);
  }, [index, loading]); // 只负责发音，不处理状态

  // 默写模式下的状态初始化（与发音分离）
  useEffect(() => {
    if (!currentWord || loading || mode !== "dictation") return;
    setDict(INITIAL_DICTATION);
    // 等渲染完再 focus
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [index, loading, mode]);

  const advanceOrReload = useCallback(async () => {
    if (index + 1 < queueRef.current.length) {
      setIndex((i) => i + 1);
      setShowAnswer(false);
      setDict(INITIAL_DICTATION);
    } else {
      try {
        const res = await englishApi.getStudyQueue(bookId, 20);
        setQueue(res.data);
        queueRef.current = res.data;
        setIndex(0);
        setShowAnswer(false);
        setDict(INITIAL_DICTATION);
      } catch {
        setQueue([]);
      }
    }
  }, [index, bookId]);

  const handleRate = useCallback(
    (rating: "again" | "hard" | "good" | "easy") => {
      if (!currentWord) return;
      englishApi.reviewWord(currentWord.id, rating).catch(() => {});
      advanceOrReload();
    },
    [currentWord, advanceOrReload],
  );

  const handleDictationSubmit = useCallback(() => {
    if (!currentWord) return;
    const correct = dict.input.trim().toLowerCase() === currentWord.spelling.toLowerCase();
    setDict((d) => ({ ...d, result: correct ? "correct" : "wrong", step: "result" }));
    if (correct) {
      setTimeout(() => speak(currentWord.spelling), 200);
    }
  }, [currentWord, dict.input]);

  const handleDictationResult = useCallback(
    (rating: "again" | "hard" | "good" | "easy") => {
      handleRate(rating);
    },
    [handleRate],
  );

  const toggleStar = useCallback(() => {
    if (!currentWord) return;
    const newStarred = !currentWord.isStarred;
    setQueue((prev): Word[] | null =>
      prev ? prev.map((w, i) => (i === index ? { ...w, isStarred: newStarred } : w)) : prev,
    );
    englishApi.toggleStar(currentWord.id, newStarred).catch(() => {});
  }, [currentWord, index]);

  const playAudio = useCallback(() => {
    if (!currentWord) return;
    speak(currentWord.spelling);
  }, [currentWord]);

  // 键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || !currentWord) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (mode === "card") {
        if (e.code === "Space") {
          e.preventDefault();
          setShowAnswer((v) => !v);
        } else if (showAnswer && RATING_KEYS[e.key]) {
          e.preventDefault();
          handleRate(RATING_KEYS[e.key] as "again" | "hard" | "good" | "easy");
        }
      } else {
        if (dict.step === "result" && RATING_KEYS[e.key]) {
          e.preventDefault();
          handleDictationResult(RATING_KEYS[e.key] as "again" | "hard" | "good" | "easy");
        } else if (dict.step === "listen" && e.code === "Space") {
          e.preventDefault();
          playAudio();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, currentWord, showAnswer, handleRate, mode, dict.step, handleDictationResult, playAudio]);

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
          <p className="max-w-sm text-sm text-muted">暂无待复习或新学单词，明天再来打卡吧！或者切换到其他词书继续学习。</p>
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
      {/* 顶部导航 + 模式切换 */}
      <div className="flex items-center justify-between">
        <Link href="/english/words" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 词书列表
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-surface-muted p-0.5">
            <button
              onClick={() => {
                setMode("card");
                setShowAnswer(false);
                setDict(INITIAL_DICTATION);
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                mode === "card"
                  ? "bg-primary text-white"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              <CardIcon className="h-3.5 w-3.5" />
              卡片
            </button>
            <button
              onClick={() => {
                setMode("dictation");
                setShowAnswer(false);
                setDict(INITIAL_DICTATION);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                mode === "dictation"
                  ? "bg-primary text-white"
                  : "text-text-tertiary hover:text-text"
              }`}
            >
              <PenLine className="h-3.5 w-3.5" />
              默写
            </button>
          </div>
          <span className="text-xs font-medium text-text-tertiary">
            {index + 1} / {queue.length}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 卡片模式 */}
      {mode === "card" && (
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
              <button
                onClick={() => {
                  playAudio();
                  if (!showAnswer) setShowAnswer(true);
                }}
                className="group text-4xl font-bold tracking-tight transition-all hover:text-primary cursor-pointer"
                title="点击查看详情"
              >
                {word.spelling}
              </button>
              <button
                onClick={playAudio}
                className="flex items-center justify-center rounded-full bg-surface-elevated p-2.5 text-primary transition-all hover:scale-105 hover:bg-primary hover:text-white active:scale-95"
                aria-label="发音"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
            {word.phonetic && (
              <p className="mt-2 text-sm text-text-tertiary">{word.phonetic}</p>
            )}
            {word.pos && (
              <p className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {word.pos}
              </p>
            )}
          </div>

          <div className="mt-8">
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full rounded-[10px] border border-dashed border-border-subtle bg-surface/40 py-6 text-sm text-muted transition-colors hover:border-primary/40 hover:bg-surface-elevated"
              >
                点击单词或这里显示完整释义 <span className="ml-2 text-[10px] text-text-tertiary">（空格键）</span>
              </button>
            ) : (
              <div className="space-y-4">
                {/* 释义 */}
                <div className="rounded-[10px] bg-surface-muted/50 p-4">
                  {word.pos && (
                    <span className="mr-2 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {word.pos}
                    </span>
                  )}
                  <p className="mt-1 text-base leading-relaxed text-text">{word.meaning}</p>
                </div>

                {/* 例句 + 写句子按钮 */}
                {word.exampleEn && (
                  <div className="rounded-[10px] bg-surface-elevated/60 p-4 border border-border-subtle/40">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-text-tertiary">例句</p>
                      <button
                        onClick={() => {
                          setDict((d) => ({ ...d, sentenceInput: "", sentenceCompare: false }));
                          setShowAnswer(true);
                          setTimeout(() => sentenceInputRef.current?.focus(), 50);
                        }}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                      >
                        <Sparkles className="h-3 w-3" />
                        写句子
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-text">{word.exampleEn}</p>
                    {word.exampleZh && (
                      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                        {word.exampleZh}
                      </p>
                    )}
                  </div>
                )}

                {/* 写句子输入框 */}
                {showAnswer && (
                  <div className="rounded-[10px] bg-gradient-to-r from-primary/5 to-ai/5 p-4 border border-primary/10">
                    <div className="flex items-center gap-1 mb-2">
                      <Lightbulb className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-medium text-primary">用这个词造个句子吧</p>
                    </div>
                    <textarea
                      ref={sentenceInputRef}
                      value={dict.sentenceInput}
                      onChange={(e) => setDict((d) => ({ ...d, sentenceInput: e.target.value }))}
                      placeholder={`用 "${word.spelling}" 造一个句子...`}
                      className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm text-text placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      rows={2}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!dict.sentenceInput.trim()}
                        onClick={() => setDict((d) => ({ ...d, sentenceCompare: true }))}
                      >
                        对比例句
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDict((d) => ({ ...d, sentenceInput: "", sentenceCompare: false }))}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}

                {/* 句子对比 */}
                {dict.sentenceCompare && dict.sentenceInput.trim() && (
                  <div className="rounded-[10px] border border-success/20 bg-success/5 p-4">
                    <p className="text-xs font-medium text-success mb-2">你的句子</p>
                    <p className="text-sm text-text mb-3">{dict.sentenceInput}</p>
                    <div className="border-t border-border-subtle pt-2">
                      <p className="text-xs font-medium text-primary mb-1">参考例句</p>
                      <p className="text-sm text-text">{word.exampleEn}</p>
                      {word.exampleZh && (
                        <p className="mt-1 text-xs text-text-secondary">{word.exampleZh}</p>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-text-tertiary">
                      💡 关注句子结构和用词，可以对比学习更好的表达方式
                    </p>
                  </div>
                )}

                {/* AI 记忆法 */}
                {word.aiMnemonic && !showAnswer && (
                  <div className="rounded-[10px] bg-gradient-to-r from-primary/5 to-ai/5 p-4 border border-primary/10">
                    <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                      <span>💡</span> AI 记忆技巧
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      {word.aiMnemonic}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 默写模式 */}
      {mode === "dictation" && (
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

          {/* 步骤1: 听音 */}
          {dict.step === "listen" && (
            <div className="mt-8 flex flex-col items-center">
              <p className="text-sm text-muted mb-6">点击播放单词发音，然后拼写出来</p>
              <button
                onClick={playAudio}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Volume2 className="h-8 w-8" />
              </button>
              <p className="mt-3 text-xs text-text-tertiary">（空格键快速播放）</p>

              <Button
                className="mt-8"
                variant="primary"
                onClick={() => {
                  setDict((d) => ({ ...d, step: "typing" }));
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                我听清楚了，开始拼写
              </Button>
              <button
                onClick={() => setShowAnswer(true)}
                className="mt-3 text-xs text-muted hover:text-text"
              >
                没听清，显示单词
              </button>
            </div>
          )}

          {/* 步骤2: 拼写 */}
          {dict.step === "typing" && (
            <div className="mt-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted mb-2">请输入你听到的单词</p>
                <button
                  onClick={playAudio}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-4 py-2 text-xs text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  再听一次
                </button>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={dict.input}
                onChange={(e) => setDict((d) => ({ ...d, input: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleDictationSubmit();
                  }
                }}
                placeholder="在这里输入单词..."
                className="w-full rounded-lg border-2 border-border-subtle bg-surface px-4 py-3 text-center text-xl font-semibold text-text placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />

              {showAnswer && (
                <div className="rounded-[10px] bg-surface-muted/50 p-3 text-center">
                  <p className="text-xs text-text-tertiary mb-1">提示</p>
                  <p className="text-sm text-text">{word.spelling}</p>
                </div>
              )}

              <div className="rounded-[10px] bg-surface-elevated/60 p-3 border border-border-subtle/40">
                <p className="text-xs text-text-tertiary mb-1">{word.pos} {word.meaning}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="primary"
                  disabled={!dict.input.trim()}
                  onClick={handleDictationSubmit}
                >
                  提交答案
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDict((d) => ({ ...d, step: "listen", input: "" }));
                    setShowAnswer(false);
                  }}
                >
                  重新听
                </Button>
              </div>
            </div>
          )}

          {/* 步骤3: 结果 */}
          {dict.step === "result" && (
            <div className="mt-6 space-y-4">
              <div
                className={`rounded-[10px] p-4 text-center ${
                  dict.result === "correct"
                    ? "bg-success/10 border border-success/30"
                    : "bg-danger/10 border border-danger/30"
                }`}
              >
                {dict.result === "correct" ? (
                  <>
                    <Check className="mx-auto h-10 w-10 text-success" />
                    <p className="mt-2 text-lg font-bold text-success">正确！</p>
                  </>
                ) : (
                  <>
                    <X className="mx-auto h-10 w-10 text-danger" />
                    <p className="mt-2 text-lg font-bold text-danger">拼写错误</p>
                  </>
                )}
              </div>

              <div className="rounded-[10px] bg-surface-muted/50 p-4 text-center">
                <p className="text-2xl font-bold text-text">{word.spelling}</p>
                {word.phonetic && (
                  <p className="text-sm text-text-tertiary mt-1">{word.phonetic}</p>
                )}
                <p className="mt-2 text-sm text-text">{word.pos} {word.meaning}</p>
              </div>

              {/* 例句 + 写句子 */}
              {word.exampleEn && (
                <div className="rounded-[10px] bg-surface-elevated/60 p-4 border border-border-subtle/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-text-tertiary">例句</p>
                    <button
                      onClick={() => setDict((d) => ({ ...d, sentenceInput: "", sentenceCompare: false }))}
                      className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <Sparkles className="h-3 w-3" />
                      写句子
                    </button>
                  </div>
                  <p className="text-sm text-text">{word.exampleEn}</p>
                  {word.exampleZh && (
                    <p className="mt-1 text-xs text-text-secondary">{word.exampleZh}</p>
                  )}
                </div>
              )}

              {/* 写句子 */}
              {showAnswer && (
                <div className="rounded-[10px] bg-gradient-to-r from-primary/5 to-ai/5 p-4 border border-primary/10">
                  <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5" />
                    用这个词造个句子
                  </p>
                  <textarea
                    value={dict.sentenceInput}
                    onChange={(e) => setDict((d) => ({ ...d, sentenceInput: e.target.value }))}
                    placeholder={`用 "${word.spelling}" 造一个句子...`}
                    className="w-full rounded-lg border border-border-subtle bg-surface p-3 text-sm text-text placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    rows={2}
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!dict.sentenceInput.trim()}
                      onClick={() => setDict((d) => ({ ...d, sentenceCompare: true }))}
                    >
                      对比例句
                    </Button>
                  </div>
                </div>
              )}

              {dict.sentenceCompare && dict.sentenceInput.trim() && (
                <div className="rounded-[10px] border border-success/20 bg-success/5 p-4">
                  <p className="text-xs font-medium text-success mb-1">你的句子</p>
                  <p className="text-sm text-text mb-2">{dict.sentenceInput}</p>
                  <div className="border-t border-border-subtle pt-2">
                    <p className="text-xs font-medium text-primary mb-1">参考例句</p>
                    <p className="text-sm text-text">{word.exampleEn}</p>
                  </div>
                </div>
              )}

              {/* 评分按钮 */}
              <div>
                <p className="text-xs text-text-tertiary text-center mb-2">请评价本次默写</p>
                <div className="grid grid-cols-4 gap-2">
                  {(["again", "hard", "good", "easy"] as const).map((r, i) => (
                    <Button
                      key={r}
                      variant="ghost"
                      onClick={() => handleDictationResult(r)}
                      className={`h-12 text-sm font-semibold ${RATING_STYLES[r]}`}
                    >
                      <span>{RATING_LABELS[r]}</span>
                      <span className="ml-1 text-[10px] opacity-60">{i + 1}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 卡片模式下的评分按钮 */}
      {mode === "card" && showAnswer && (
        <div className="grid grid-cols-4 gap-2">
          {(["again", "hard", "good", "easy"] as const).map((r, i) => (
            <Button
              key={r}
              variant="ghost"
              onClick={() => handleRate(r)}
              className={`h-14 text-sm font-semibold ${RATING_STYLES[r]}`}
            >
              <span>{RATING_LABELS[r]}</span>
              <span className="ml-1 text-[10px] opacity-60">{i + 1}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WordStudyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl p-6">
          <div className="flex items-center justify-center py-24 text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        </div>
      }
    >
      <StudyContent />
    </Suspense>
  );
}
