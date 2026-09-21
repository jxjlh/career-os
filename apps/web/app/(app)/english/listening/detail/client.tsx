"use client";

import { ChevronLeft, Check, Loader2, Play, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, Card } from "@/components/ui";
import {
  DIFFICULTY_LABELS,
  englishApi,
  formatDuration,
  type ListeningMaterial,
} from "@/lib/english";

/**
 * 听力详情页。
 *
 * 用 query 参数（/english/listening/detail?id=xxx）而不是路径参数：
 * 本项目是 `output: "export"` 静态导出，路径动态路由在 dev 下要求
 * generateStaticParams 覆盖每个真实 id（做不到），直接访问或客户端导航都会 500。
 * 项目里 /life/goals/detail 也是同样的 query 方案。
 */
export default function ListeningDetailPage() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get("id") ?? "";
  const [material, setMaterial] = useState<ListeningMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, { isCorrect: boolean; correctAnswer: string }>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!materialId) return;
    englishApi.getListening(materialId)
      .then((res) => setMaterial(res.data))
      .catch(() => setMaterial(null))
      .finally(() => setLoading(false));
  }, [materialId]);

  // 优先用已上传的音频；缺失时走 /audio 端点（后端会懒合成一次再重定向）
  const audioSrc = material
    ? material.audioUrl || englishApi.listeningAudioUrl(material.id)
    : "";

  const speakInBrowser = () => {
    if (!material) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(material.transcript);
      utter.lang = "en-US";
      utter.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  };

  const playTTS = () => {
    if (!material) return;
    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      // 后端合成失败时才退回浏览器原生朗读
      audio.play().catch(() => speakInBrowser());
      return;
    }
    speakInBrowser();
  };

  const submitAnswer = async (qIndex: number) => {
    if (!material || submitting !== null) return;
    const answer = answers[qIndex] ?? "";
    if (!answer.trim()) return;
    setSubmitting(qIndex);
    try {
      const res = await englishApi.submitAttempt(material.id, {
        questionIndex: qIndex,
        userAnswer: answer,
        durationSeconds: Math.round(Date.now() / 1000),
      });
      setResults((prev) => ({ ...prev, [qIndex]: res.data }));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载听力材料...
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/english/listening" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 返回列表
        </Link>
        <Card className="p-8 text-center">
          <p className="text-muted">材料不存在</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link href="/english/listening" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft className="h-4 w-4" /> 返回列表
        </Link>
        <span className="text-xs text-text-tertiary">
          {formatDuration(liveDuration ?? material.durationSeconds)}
        </span>
      </div>

      {/* 音频播放器 */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{material.title}</h2>
            <p className="mt-1 text-xs text-muted">
              难度: {DIFFICULTY_LABELS[material.difficulty] ?? material.difficulty}
            </p>
          </div>
          <Button onClick={playTTS} variant="primary" size="sm">
            <Play className="h-3.5 w-3.5 fill-current" /> 播放
          </Button>
        </div>
        {audioSrc && (
          <audio
            controls
            src={audioSrc}
            className="mt-4 w-full"
            onLoadedMetadata={(e) => {
              // 后端解析不到时长时, 用浏览器解出的真实时长兜底
              const d = Math.round(e.currentTarget.duration || 0);
              if (d > 0) setLiveDuration(d);
            }}
          />
        )}
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="mt-3 text-xs font-medium text-primary hover:text-primary-hover"
        >
          {showTranscript ? "隐藏文本" : "显示文本"}
        </button>
        {showTranscript && material.transcript && (
          <div className="mt-3 rounded-[10px] bg-surface-muted/50 p-4 text-sm leading-relaxed">
            {material.transcript}
            {material.translation && (
              <p className="mt-3 text-xs text-muted">{material.translation}</p>
            )}
          </div>
        )}
      </Card>

      {/* 问答区 */}
      <div className="space-y-3">
        {material.questions.map((q, idx) => {
          const hasResult = results[idx] !== undefined;
          const isCorrect = results[idx]?.isCorrect;
          return (
            <Card key={idx} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">
                    Q{idx + 1}. {q.question}
                  </p>
                  {q.hint && <p className="mt-1 text-xs text-text-tertiary">提示: {q.hint}</p>}
                </div>
                {hasResult && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isCorrect ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
                    }`}
                  >
                    {isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {isCorrect ? "正确" : "错误"}
                  </span>
                )}
              </div>

              {q.type === "choice" && q.options ? (
                <div className="mt-3 space-y-2">
                  {q.options.map((opt) => {
                    const selected = answers[idx] === opt;
                    const showCorrect = hasResult && opt === results[idx]?.correctAnswer;
                    const showWrong = hasResult && selected && !isCorrect;
                    return (
                      <button
                        key={opt}
                        disabled={hasResult}
                        onClick={() => setAnswers((prev) => ({ ...prev, [idx]: opt }))}
                        className={`w-full rounded-[10px] border px-3 py-2 text-left text-sm transition-all ${
                          showCorrect
                            ? "border-success bg-success/12"
                            : showWrong
                            ? "border-danger bg-danger/12"
                            : selected
                            ? "border-primary bg-primary/8"
                            : "border-border bg-surface/60 hover:border-primary/40"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[idx] ?? ""}
                  disabled={hasResult}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                  placeholder="输入你的答案"
                  className="mt-3 h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm text-text transition-shadow focus-visible:outline-none focus-visible:border-primary/50"
                />
              )}

              {hasResult && (
                <p className="mt-2 text-xs text-muted">
                  正确答案: <span className="font-medium text-text">{results[idx]?.correctAnswer}</span>
                </p>
              )}

              {!hasResult && (
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={!answers[idx]?.trim() || submitting === idx}
                  onClick={() => submitAnswer(idx)}
                >
                  {submitting === idx ? "提交中..." : "提交答案"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
