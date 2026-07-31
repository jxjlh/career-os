"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ListChecks, Mic, Plus, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge, Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };

export default function InterviewsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [session, setSession] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      recognitionRef.current?.stop?.();
    };
  }, []);

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setAnswer((prev) => (prev ? `${prev}${text}` : text));
    };
    recognition.start();
    recognitionRef.current = recognition;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.start();
    } catch {
      // transcription still works without audio capture
    }
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop?.();
    recorderRef.current?.stream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    setRecording(false);
  };

  const interviews = useQuery<Envelope>({
    queryKey: ["interviews"],
    queryFn: () => apiFetch("/interviews"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/interviews", {
        method: "POST",
        body: JSON.stringify({ title: title || "模拟面试", mode: "star", role: role || undefined }),
      }),
    onSuccess: () => {
      setTitle("");
      setRole("");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
  });

  const startSession = async (interviewId: string) => {
    const res = await apiFetch<Envelope>(`/interviews/${interviewId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ questionCount: 5 }),
    });
    setSession(res.data);
    setIndex(0);
    setFeedback(null);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    const question = session.questions[index];
    await apiFetch(`/sessions/${session.sessionId}/answer`, {
      method: "POST",
      body: JSON.stringify({ questionId: question.id, answerText: answer.trim() }),
    });
    setAnswer("");
    if (index + 1 < session.questions.length) {
      setIndex(index + 1);
    } else {
      await apiFetch(`/sessions/${session.sessionId}/finish`, { method: "POST" });
      const fb = await apiFetch<Envelope>(`/sessions/${session.sessionId}/feedback`);
      setFeedback(fb.data);
      setSession(null);
    }
  };

  const currentQuestion = session?.questions?.[index];

  return (
    <div>
      <SectionHeader
        title={t("nav.interviews")}
        action={
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("interviews.titlePh")} className="w-40" />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("interviews.rolePh")} className="w-44" />
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </form>
        }
      />

      {session ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              {t("interviews.questionOf")
                .replace("{current}", String(index + 1))
                .replace("{total}", String(session.questions.length))}
            </span>
            <Badge variant="primary">{session.questions[index].type}</Badge>
          </div>
          <p className="mb-4 text-[15px] font-medium leading-relaxed">{currentQuestion.question}</p>
          <Textarea
            rows={5}
            placeholder={t("interviews.answerPh")}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">
              {recording ? "语音转写中..." : "也可点击录音，用浏览器 Web Speech 转写中文"}
            </span>
            <Button
              size="sm"
              variant={recording ? "danger" : "outline"}
              onClick={recording ? stopRecording : () => void startRecording()}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {recording ? "停止录音" : "语音答题"}
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submitAnswer} disabled={!answer.trim()}>
              {index + 1 < session.questions.length ? (
                <>
                  <Send className="h-4 w-4" />
                  {t("interviews.nextQ")}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t("interviews.finish")}
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : feedback ? (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("interviews.score")}</h2>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {feedback.overallScore}
            </div>
            <div className="flex-1 space-y-2">
              {Object.entries(feedback.dimensions || {}).map(([key, value]: any) => (
                <div key={key} className="flex items-center gap-2 text-[13px]">
                  <span className="w-28 text-muted">{key}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${value.score}%` }} />
                  </div>
                  <span className="w-8 text-right">{value.score}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-muted">{feedback.strengths}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(interviews.data?.data || []).map((interview: any) => (
            <Card key={interview.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{interview.title}</p>
                <p className="text-[13px] text-muted">
                  {interview.role || "未设置岗位"} · {interview.mode}
                </p>
              </div>
              <Badge>{interview.status}</Badge>
              <Button size="sm" onClick={() => startSession(interview.id)}>
                <ListChecks className="h-4 w-4" />
                {t("interviews.start")}
              </Button>
            </Card>
          ))}
          {(!interviews.data?.data || interviews.data.data.length === 0) && (
            <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
              {t("interviews.noInterviews")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
