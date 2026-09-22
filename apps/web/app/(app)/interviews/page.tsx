"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FileText,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Mic,
  Plus,
  Search,
  Send,
  Square,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge, Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Envelope = { data: any };
type Step = "form" | "preview" | "interview" | "feedback";

const JD_SOURCE_LABEL: Record<string, string> = {
  user: "你提供的 JD",
  search: "公开检索归纳",
  inferred: "AI 按岗位推断（仅供参考）",
};

export default function InterviewsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);

  // 表单
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jdText, setJdText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [prepareResult, setPrepareResult] = useState<any>(null);

  // 面试
  const [session, setSession] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [followUp, setFollowUp] = useState<any>(null);
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

  const resumes = useQuery<Envelope>({
    queryKey: ["resumes"],
    queryFn: () => apiFetch("/resumes"),
  });

  const interviews = useQuery<Envelope>({
    queryKey: ["interviews"],
    queryFn: () => apiFetch("/interviews"),
  });

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

  const prepare = useMutation({
    mutationFn: async () => {
      let rid = resumeId;
      let rtext = resumeText.trim();
      if (resumeFile) {
        const fd = new FormData();
        fd.append("file", resumeFile);
        fd.append("title", title || resumeFile.name);
        const up = await apiFetch<Envelope>("/resumes/upload", { method: "POST", body: fd });
        rid = up.data.id;
        rtext = up.data.rawText;
      }
      return apiFetch<Envelope>("/interviews/prepare", {
        method: "POST",
        body: JSON.stringify({
          title: title || `${role} 模拟面试`,
          role,
          company: company || undefined,
          jdText: jdText.trim() || undefined,
          resumeId: rid || undefined,
          resumeText: rtext || undefined,
          mode: "star",
          difficulty: "intermediate",
        }),
      });
    },
    onSuccess: (res) => {
      setPrepareResult(res.data);
      setStep("preview");
    },
  });

  const startSession = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<Envelope>(`/interviews/${prepareResult.interviewId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ questionCount: 5 }),
      });
      setSession(res.data);
      setIndex(0);
      setFollowUp(null);
      setFeedback(null);
      setStep("interview");
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await apiFetch(`/sessions/${session.sessionId}/finish`, { method: "POST" });
    const fb = await apiFetch<Envelope>(`/sessions/${session.sessionId}/feedback`);
    setFeedback(fb.data);
    setSession(null);
    setStep("feedback");
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    const question = session.questions[index];
    const body: any = { questionId: question.id, answerText: answer.trim() };
    if (followUp) body.followUpQuestion = followUp.text;
    setBusy(true);
    try {
      const res = await apiFetch<Envelope>(`/sessions/${session.sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAnswer("");
      if (res.data?.followUp) {
        setFollowUp(res.data.followUp);
        return;
      }
      setFollowUp(null);
      if (index + 1 < session.questions.length) {
        setIndex(index + 1);
      } else {
        await finish();
      }
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setStep("form");
    setPrepareResult(null);
    setSession(null);
    setFeedback(null);
    setResumeFile(null);
    setJdText("");
    setFollowUp(null);
  };

  const currentQuestion = session?.questions?.[index];

  return (
    <div>
      <SectionHeader title={t("nav.interviews")} action={<StepBadge step={step} />} />

      {step === "form" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-medium">目标岗位</h3>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="岗位名称，如 新媒体运营 / 数据分析师" />
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="目标公司（可选，用于检索该司 JD）" />
            <div>
              <p className="mb-1 text-[13px] text-muted">岗位 JD（可选）—— 留空则自动联网检索真实 JD，并标注来源</p>
              <Textarea
                rows={5}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="粘贴招聘要求 / 岗位职责 / 任职要求"
              />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-medium">你的简历</h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px] hover:bg-surface-muted">
                <Upload className="h-4 w-4" />
                {resumeFile ? resumeFile.name : "上传简历文件"}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md,image/*"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
              </label>
              <span className="text-[12px] text-muted">PDF / Word / 图片</span>
            </div>

            {(resumes.data?.data || []).length > 0 && (
              <div>
                <p className="mb-1 text-[13px] text-muted">或选择已上传的简历</p>
                <select
                  className="w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[13px]"
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                >
                  <option value="">不选</option>
                  {(resumes.data?.data || []).map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <p className="mb-1 text-[13px] text-muted">或直接粘贴简历全文</p>
              <Textarea rows={6} value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="粘贴简历文字内容" />
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!role.trim() || (!resumeFile && !resumeText.trim() && !resumeId) || prepare.isPending}
                onClick={() => prepare.mutate()}
              >
                {prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                生成面试（匹配 JD 与简历）
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === "preview" && prepareResult && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">岗位 JD</h3>
              <Badge>{JD_SOURCE_LABEL[prepareResult.jdSource] || prepareResult.jdSource}</Badge>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
              {prepareResult.jdText}
            </pre>
            {(prepareResult.jdMeta?.sources || []).length > 0 && (
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <p className="text-[12px] text-muted">检索来源：</p>
                {prepareResult.jdMeta.sources.slice(0, 4).map((s: any, i: number) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] text-primary hover:underline">
                    <LinkIcon className="h-3 w-3" />
                    {s.title || s.url}
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-medium">简历与 JD 匹配预览</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] font-medium text-success">已覆盖的关键词</p>
                <div className="flex flex-wrap gap-1.5">
                  {(prepareResult.matchPreview.matchedKeywords || []).map((k: string) => (
                    <Badge key={k}>{k}</Badge>
                  ))}
                  {prepareResult.matchPreview.matchedKeywords?.length === 0 && (
                    <span className="text-[12px] text-muted">暂无</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-medium text-danger">简历里没体现的关键词</p>
                <div className="flex flex-wrap gap-1.5">
                  {(prepareResult.matchPreview.missingKeywords || []).map((k: string) => (
                    <Badge key={k} variant="danger">
                      {k}
                    </Badge>
                  ))}
                  {prepareResult.matchPreview.missingKeywords?.length === 0 && (
                    <span className="text-[12px] text-muted">暂无</span>
                  )}
                </div>
              </div>
            </div>
            {(prepareResult.matchPreview.hardRequirements || []).length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-[12px] text-muted">硬性要求字面命中情况：</p>
                <ul className="space-y-1">
                  {prepareResult.matchPreview.hardRequirements.map((h: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-[13px]">
                      <span className={h.matched ? "text-success" : "text-danger"}>{h.matched ? "✓" : "✕"}</span>
                      {h.requirement}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted">{prepareResult.matchPreview.note}</p>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={startNew}>
              返回修改
            </Button>
            <Button onClick={startSession} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
              开始面试
            </Button>
          </div>
        </div>
      )}

      {step === "interview" && session && currentQuestion && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              第 {index + 1} / {session.questions.length} 题
              {followUp && <span className="ml-2 text-[12px] text-warning">追问（第 {followUp.round} 轮）</span>}
            </span>
            <div className="flex items-center gap-2">
              {currentQuestion.gap && <Badge variant="danger">能力缺口题</Badge>}
              <Badge variant="primary">{currentQuestion.type}</Badge>
            </div>
          </div>

          <p className="mb-1 text-[15px] font-medium leading-relaxed">
            {followUp ? followUp.text : currentQuestion.question}
          </p>
          {!followUp && (currentQuestion.jdRequirement || currentQuestion.resumeHook) && (
            <div className="mb-3 space-y-1 rounded-[8px] bg-surface p-3 text-[12px] text-muted">
              {currentQuestion.jdRequirement && <p>考察 JD：{currentQuestion.jdRequirement}</p>}
              {currentQuestion.resumeHook && <p>锚定简历：{currentQuestion.resumeHook}</p>}
              {currentQuestion.intent && <p>意图：{currentQuestion.intent}</p>}
            </div>
          )}

          <Textarea rows={5} placeholder="用你自己的经历作答，尽量给出具体数字" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted">{recording ? "语音转写中..." : "可点击录音，用浏览器 Web Speech 转写中文"}</span>
            <Button size="sm" variant={recording ? "danger" : "outline"} onClick={recording ? stopRecording : () => void startRecording()}>
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {recording ? "停止录音" : "语音答题"}
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={submitAnswer} disabled={!answer.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : followUp ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {followUp ? "提交追问回答" : index + 1 < session.questions.length ? "下一题" : "提交并查看报告"}
            </Button>
          </div>
        </Card>
      )}

      {step === "feedback" && feedback && (
        <div className="space-y-4">
          <Card className="p-5">
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
                {feedback.jdMatchScore != null && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="w-28 font-medium">岗位匹配度</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-success" style={{ width: `${feedback.jdMatchScore}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium">{feedback.jdMatchScore}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mb-1 text-[13px] text-muted">
              <span className="font-medium text-text">优势：</span>
              {feedback.strengths}
            </p>
            <p className="text-[13px] text-muted">
              <span className="font-medium text-text">待改进：</span>
              {feedback.improvements}
            </p>
          </Card>

          {(feedback.jdCoverage || []).length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-medium">JD 要求逐条核对</h3>
              <ul className="space-y-2">
                {feedback.jdCoverage.map((c: any, i: number) => (
                  <li key={i} className="rounded-[8px] bg-surface p-3 text-[13px]">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={c.verdict === "covered" ? "primary" : c.verdict === "partial" ? "warning" : "danger"}>
                        {c.verdict === "covered" ? "已覆盖" : c.verdict === "partial" ? "部分覆盖" : "未覆盖"}
                      </Badge>
                      <span className="font-medium">{c.requirement}</span>
                    </div>
                    <p className="text-muted">{c.evidence || "无证据"}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(feedback.resumeAdvice || []).length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-medium">简历优化建议（按 JD 缺什么补什么）</h3>
              <ul className="space-y-3">
                {feedback.resumeAdvice.map((a: any, i: number) => (
                  <li key={i} className="rounded-[8px] bg-surface p-3 text-[13px]">
                    <p className="mb-1 font-medium">{a.requirement}</p>
                    <p className="text-muted">问题：{a.problem}</p>
                    <p className="text-muted">建议：{a.suggestion}</p>
                    {a.exampleLine && (
                      <p className="mt-2 rounded-[6px] border border-border bg-background p-2 font-medium">
                        可写：{a.exampleLine}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {feedback.sampleAnswer && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-medium">参考答案示范</h3>
              <p className="text-[13px] text-muted">{feedback.sampleAnswer}</p>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={startNew}>
              再来一场
            </Button>
          </div>
        </div>
      )}

      {step === "form" && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">历史面试</h3>
          <div className="space-y-2">
            {(interviews.data?.data || []).map((interview: any) => (
              <Card key={interview.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{interview.title}</p>
                  <p className="text-[13px] text-muted">
                    {interview.role || "未设置岗位"} · {interview.mode}
                    {interview.jdSource && <span className="ml-2">JD：{JD_SOURCE_LABEL[interview.jdSource] || interview.jdSource}</span>}
                  </p>
                </div>
                <Badge>{interview.status}</Badge>
              </Card>
            ))}
            {(!interviews.data?.data || interviews.data.data.length === 0) && (
              <p className="rounded-[8px] border border-dashed border-border bg-surface p-8 text-center text-[13px] text-muted">
                还没有面试记录，先在上方创建一场吧
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ step }: { step: Step }) {
  const label = { form: "填写材料", preview: "匹配预览", interview: "面试中", feedback: "报告" }[step];
  return <Badge variant="primary">{label}</Badge>;
}
