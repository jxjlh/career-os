"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Search, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EChart } from "@/components/chart";
import { Badge, Button, Card, Input, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Envelope = { data: any };

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [situation, setSituation] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<any>(null);

  const matrix = useQuery<Envelope>({ queryKey: ["skill-matrix"], queryFn: () => apiFetch("/skills/matrix") });
  const plan = useQuery<Envelope>({ queryKey: ["planner-current"], queryFn: () => apiFetch("/planner/current") });
  const items = matrix.data?.data.items || [];
  const selected = items.find((skill: any) => skill.skillId === selectedId) || items[0];
  const selectedSkillId = selected?.skillId || "";
  const learningSkills = useMemo(() => items.filter((skill: any) => (skill.targetLevel || 0) > (skill.currentLevel || 0) || (skill.targetLevel || 0) > 0), [items]);

  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].skillId);
  }, [items, selectedId]);

  const update = useMutation({
    mutationFn: ({ id, current, target }: { id: string; current: number; target: number }) => apiFetch(`/skills/${id}/progress`, { method: "PUT", body: JSON.stringify({ currentLevel: current, targetLevel: target, confidence: 0 }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skill-matrix"] }),
  });
  const recommendation = useMutation({
    mutationFn: () => apiFetch<Envelope>(`/skills/${selectedSkillId}/recommendations`, { method: "POST", body: JSON.stringify({ currentSituation: situation, weeklyMinutes: 420 }) }),
  });
  const generatePlan = useMutation({
    mutationFn: () => apiFetch<Envelope>("/planner/generate", { method: "POST", body: JSON.stringify({ weeklyStudyMinutes: 420, prioritySkills: [selectedSkillId], goalIds: [] }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });
  const saveResource = useMutation({
    mutationFn: (resourceId: string) => apiFetch("/library/bookmarks", { method: "POST", body: JSON.stringify({ resourceId }) }),
  });

  const searchResources = async (queryOverride?: string) => {
    const query = queryOverride?.trim() || searchQuery.trim() || `${selected?.name || "技能"} 学习资源 官方教程 实战`;
    setSearching(true); setSearchResults([]);
    try {
      const response = await apiFetch<Envelope>("/explore/search", { method: "POST", body: JSON.stringify({ query, limit: 12 }) });
      for (let index = 0; index < 30; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const job = await apiFetch<Envelope>(`/explore/jobs/${response.data.jobId}`);
        if (job.data.status === "succeeded") { setSearchResults(job.data.result.items || []); break; }
        if (job.data.status === "failed") break;
      }
    } finally { setSearching(false); }
  };

  const startAssessment = useMutation({
    mutationFn: () => apiFetch<Envelope>("/career/assessment", { method: "POST", body: JSON.stringify({ topic: selected?.name || "当前技能" }) }),
    onSuccess: (response) => { const nextQuestions = response.data.questions || []; setQuestions(nextQuestions); setAnswers(nextQuestions.map(() => "")); setAssessment(null); },
  });
  const submitAssessment = useMutation({
    mutationFn: () => apiFetch<Envelope>("/career/assessment", { method: "POST", body: JSON.stringify({ topic: selected?.name || "当前技能", answers: questions.map((question, index) => ({ question: question.question, answer: answers[index] || "" })) }) }),
    onSuccess: (response) => setAssessment(response.data),
  });

  const radarOption = { tooltip: {}, radar: { indicator: items.slice(0, 8).map((skill: any) => ({ name: skill.name, max: 10 })), radius: "65%" }, series: [{ type: "radar", data: [{ value: items.slice(0, 8).map((skill: any) => skill.currentLevel || 0), name: "当前水平", areaStyle: { opacity: 0.18 } }, { value: items.slice(0, 8).map((skill: any) => skill.targetLevel || 0), name: "目标水平" }] }], legend: { bottom: 0, textStyle: { color: "var(--muted)" } } };

  return <div className="space-y-5"><SectionHeader title="技能矩阵" subtitle="先看全局能力结构，再进入任意技能制定学习路径。" /><Card className="p-4">{matrix.isLoading ? <Skeleton className="h-[300px]" /> : <EChart option={radarOption} height={300} />}</Card><Card className="p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">想学的技能</h2><p className="mt-1 text-xs text-muted">点击技能后，下面会展示 AI 推荐资源、搜索结果、计划和考核。</p></div><Target className="h-5 w-5 text-primary" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{learningSkills.map((skill: any) => <button key={skill.skillId} type="button" onClick={() => { setSelectedId(skill.skillId); setSearchResults([]); setAssessment(null); }} className={`rounded-xl border p-3 text-left transition ${selectedSkillId === skill.skillId ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{skill.name}</p><Badge>{skill.category}</Badge></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((skill.currentLevel || 0) / Math.max(1, skill.targetLevel || 10)) * 100)}%` }} /></div><p className="mt-1 text-[11px] text-muted">当前 {skill.currentLevel || 0} · 目标 {skill.targetLevel || 0} · 差距 {skill.gap || 0}</p></button>)}</div></Card>{selected && <Card className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selected.name}</h2><p className="mt-1 text-xs text-muted">{selected.description || "为这个技能建立可执行的学习闭环。"}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => recommendation.mutate()} disabled={recommendation.isPending}>{recommendation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}AI 推荐路径</Button><Button size="sm" variant="outline" onClick={() => generatePlan.mutate()} disabled={generatePlan.isPending}>生成学习计划</Button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-xs font-medium text-muted">当前学习情况</p><Textarea value={situation} onChange={(event) => setSituation(event.target.value)} placeholder="填写基础、目标、可投入时间或正在学习的内容" /></div><div><p className="mb-1 text-xs font-medium text-muted">调整当前 / 目标等级</p><SkillLevelEditor skill={selected} onSave={(current, target) => update.mutate({ id: selectedSkillId, current, target })} /></div></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchResources(); }} placeholder={`搜索 ${selected.name} 的学习资源`} /><Button variant="outline" onClick={() => searchResources()} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}搜索资源</Button></div>{recommendation.data?.data && <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]"><div><h3 className="text-sm font-semibold">AI 推荐学习资源</h3><div className="mt-2 space-y-2">{(recommendation.data.data.resources || []).map((resource: any) => <div key={resource.title} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{resource.title}</p><Badge>{resource.type}</Badge></div><p className="mt-1 text-xs text-muted">{resource.reason}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setSearchQuery(resource.query); searchResources(resource.query); }}><Search className="h-3.5 w-3.5" />搜索资源</Button></div></div>)}</div></div><div><h3 className="text-sm font-semibold">7 天学习计划</h3><div className="mt-2 space-y-2">{(recommendation.data.data.plan || []).map((task: any) => <div key={`${task.day}-${task.title}`} className="rounded-lg bg-surface-muted/50 p-2 text-xs"><span className="mr-2 text-primary">Day {task.day}</span>{task.title}<span className="ml-2 text-muted">{task.minutes} 分钟</span></div>)}</div></div></div>}{searchResults.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">搜索引擎结果</h3><div className="mt-2 space-y-2">{searchResults.map((resource: any, index: number) => <div key={resource.resourceId || index} className="flex items-center gap-3 rounded-lg border border-border p-3"><Search className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{resource.title}</p><p className="truncate text-xs text-muted">{resource.sourceName || resource.provider} · {resource.description || resource.snippet}</p></div><Button size="sm" variant="ghost" onClick={() => saveResource.mutate(resource.resourceId)}>收藏</Button><a href={resource.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">打开<ExternalLink className="h-3 w-3" /></Button></a></div>)}</div></div>}<div className="mt-4 border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">AI 学习考核</h3><Button size="sm" variant="outline" onClick={() => startAssessment.mutate()} disabled={startAssessment.isPending}>生成考核题</Button></div>{questions.length > 0 && <div className="mt-3 space-y-3">{questions.map((question, index) => <div key={`${question.question}-${index}`}><p className="text-xs font-medium">{index + 1}. {question.question}</p><Textarea className="mt-1 min-h-[60px]" value={answers[index] || ""} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="写下你的理解、练习过程或结果" /></div>)}<Button size="sm" onClick={() => submitAssessment.mutate()} disabled={submitAssessment.isPending}>提交并评分</Button></div>}{assessment && <div className="mt-3 rounded-xl bg-success/10 p-4"><p className="text-2xl font-bold text-success">{assessment.score} 分</p><p className="mt-1 text-xs text-muted">{assessment.feedback}</p></div>}</div></Card>}<Card className="p-4"><h2 className="text-sm font-semibold">技能等级管理</h2><div className="mt-3 space-y-2">{items.map((skill: any) => <SkillLevelEditor key={skill.skillId} skill={skill} onSave={(current, target) => update.mutate({ id: skill.skillId, current, target })} />)}</div></Card><Card className="p-4"><h2 className="text-sm font-semibold">本周计划执行</h2><div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">{(plan.data?.data.tasks || []).filter((task: any) => task.skillId === selectedSkillId).map((task: any) => <div key={task.id} className="rounded-lg border border-border p-3 text-xs"><p className={task.status === "done" ? "line-through text-muted" : ""}>{task.title}</p><p className="mt-1 text-muted">周{task.day} · {task.estimatedMinutes} 分钟</p></div>)}</div><p className="mt-2 text-xs text-muted">生成计划后，这里会显示该技能关联的本周任务。</p></Card></div>;
}

function SkillLevelEditor({ skill, onSave }: { skill: any; onSave: (current: number, target: number) => void }) {
  const [current, setCurrent] = useState(skill.currentLevel || 0);
  const [target, setTarget] = useState(skill.targetLevel || 5);
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3"><div className="min-w-[120px] flex-1"><p className="text-sm font-medium">{skill.name}</p><p className="text-xs text-muted">{skill.category}</p></div><span className="text-xs text-muted">当前 {current}</span><input type="range" min="0" max="10" value={current} onChange={(event) => setCurrent(Number(event.target.value))} className="w-24 accent-[var(--primary)]" /><span className="text-xs text-muted">目标 {target}</span><input type="range" min="1" max="10" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="w-24 accent-[var(--primary)]" /><Button size="sm" onClick={() => onSave(current, target)}>保存</Button></div>;
}
