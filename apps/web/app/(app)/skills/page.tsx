"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EChart } from "@/components/chart";
import { TargetRoleCard } from "@/components/skills/target-role-card";
import { JdSkillCard } from "@/components/skills/jd-skill-card";
import { Badge, Button, Card, Input, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Envelope = { data: any };
type SkillCategory = "learning" | "mastered";

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  learning: "想学的技能",
  mastered: "已经会的技能",
};

export default function SkillsPage() {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<SkillCategory>("learning");
  const [selectedId, setSelectedId] = useState("");
  const [newSkillName, setNewSkillName] = useState("");

  const matrix = useQuery<Envelope>({ queryKey: ["skill-matrix"], queryFn: () => apiFetch("/skills/matrix") });
  const items = useMemo(() => matrix.data?.data.items || [], [matrix.data]);
  const categorySkills = useMemo(
    () => items.filter((skill: any) => (skill.learningStatus || "learning") === activeCategory),
    [activeCategory, items],
  );
  const selected = items.find((skill: any) => skill.skillId === selectedId) || null;
  const selectedSkillId = selected?.skillId || "";

  useEffect(() => {
    if (!categorySkills.some((skill: any) => skill.skillId === selectedId)) {
      setSelectedId(categorySkills[0]?.skillId || "");
    }
  }, [categorySkills, selectedId]);

  const createSkill = useMutation({
    mutationFn: () => apiFetch<Envelope>("/skills", {
      method: "POST",
      body: JSON.stringify({ name: newSkillName.trim(), category: "自定义", currentLevel: 1, targetLevel: 5, learningStatus: "learning" }),
    }),
    onSuccess: (response) => {
      setNewSkillName("");
      setActiveCategory("learning");
      setSelectedId(response.data.skillId);
      void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
    },
  });

  const updateSkill = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiFetch(`/skills/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] }),
  });

  const deleteSkill = useMutation({
    mutationFn: (id: string) => apiFetch(`/skills/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      if (id === selectedId) setSelectedId("");
      void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
    },
    onError: (error: any) => {
      const msg = error?.message || "删除技能失败，请稍后重试";
      alert(msg);
    },
  });

  const updateProgress = useMutation({
    mutationFn: ({ id, current, target, confidence }: { id: string; current: number; target: number; confidence: number }) => apiFetch(`/skills/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify({ currentLevel: current, targetLevel: target, confidence }),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
      void queryClient.invalidateQueries({ queryKey: ["skill-detail", selectedSkillId] });
    },
  });

  const radarOption = {
    tooltip: {},
    radar: { indicator: items.slice(0, 8).map((skill: any) => ({ name: skill.name, max: 10 })), radius: "65%" },
    series: [{ type: "radar", data: [
      { value: items.slice(0, 8).map((skill: any) => skill.currentLevel || 0), name: "当前水平", areaStyle: { opacity: 0.18 } },
      { value: items.slice(0, 8).map((skill: any) => skill.targetLevel || 0), name: "目标水平" },
    ] }],
    legend: { bottom: 0, textStyle: { color: "var(--muted)" } },
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="技能矩阵" subtitle="先看全局能力结构，再进入任意技能制定学习路径。" />
      <TargetRoleCard />
      <JdSkillCard />
      <Card className="p-4">
        {matrix.isLoading ? <Skeleton className="h-[300px]" /> : <EChart option={radarOption} height={320} />}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(CATEGORY_LABELS) as SkillCategory[]).map((category) => (
          <Button
            key={category}
            className="h-12 justify-between px-4"
            variant={activeCategory === category ? "primary" : "outline"}
            onClick={() => setActiveCategory(category)}
          >
            <span>{CATEGORY_LABELS[category]}</span>
            <Badge variant={activeCategory === category ? "ai" : "default"}>{items.filter((skill: any) => (skill.learningStatus || "learning") === category).length}</Badge>
          </Button>
        ))}
      </div>

      <Card className="p-4">
        <SectionHeader
          title={CATEGORY_LABELS[activeCategory]}
          subtitle="点击一个技能，查看等级、知识点、B站资源、考核和计划。"
          action={(
            <div className="flex gap-2">
              <Input
                className="w-36"
                value={newSkillName}
                onChange={(event) => setNewSkillName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && newSkillName.trim()) createSkill.mutate(); }}
                placeholder="添加技能名称"
              />
              <Button size="sm" variant="primary" disabled={!newSkillName.trim() || createSkill.isPending} onClick={() => createSkill.mutate()}>
                {createSkill.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}添加
              </Button>
            </div>
          )}
        />
        {categorySkills.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">还没有{CATEGORY_LABELS[activeCategory]}，从右上角添加一个技能。</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {categorySkills.map((skill: any) => (
              <SkillCard
                key={skill.skillId}
                skill={skill}
                selected={skill.skillId === selectedSkillId}
                onSelect={() => setSelectedId(skill.skillId)}
                onMove={() => updateSkill.mutate({ id: skill.skillId, payload: { learningStatus: activeCategory === "learning" ? "mastered" : "learning" } })}
                onRename={(name) => updateSkill.mutate({ id: skill.skillId, payload: { name } })}
                onDelete={() => { if (window.confirm(`删除技能“${skill.name}”？`)) deleteSkill.mutate(skill.skillId); }}
              />
            ))}
          </div>
        )}
      </Card>

      {selected && <SkillDetail skill={selected} detailKey={selectedSkillId} onProgress={(current, target, confidence) => updateProgress.mutate({ id: selectedSkillId, current, target, confidence })} />}
    </div>
  );
}

function SkillCard({ skill, selected, onSelect, onMove, onRename, onDelete }: { skill: any; selected: boolean; onSelect: () => void; onMove: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(skill.name);
  const progress = Number(skill.masteryPercent ?? Math.min(100, Math.round(((skill.currentLevel || 0) / 10) * 100)));
  const moveLabel = skill.learningStatus === "mastered" ? "移到想学" : "移到已经会";

  return (
    <Card className={`cursor-pointer p-4 transition ${selected ? "border-primary/60 bg-primary/5" : "hover:border-primary/30"}`} onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? <Input value={name} onChange={(event) => setName(event.target.value)} onClick={(event) => event.stopPropagation()} /> : <h3 className="truncate text-sm font-semibold">{skill.name}</h3>}
          <p className="mt-1 text-xs text-muted">{skill.category}</p>
        </div>
        <Badge variant={selected ? "primary" : "default"}>{skill.currentLevel || 0}/{skill.targetLevel || 0}</Badge>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>掌握度 {progress}%</span><Target className="h-3.5 w-3.5" /></div>
      <div className="mt-3 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
        {editing ? <Button size="sm" onClick={() => { onRename(name.trim()); setEditing(false); }}>保存名称</Button> : <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />修改</Button>}
        <Button size="sm" variant="ghost" onClick={onMove}>{moveLabel}</Button>
        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onDelete(); }}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
      </div>
    </Card>
  );
}

function SkillDetail({ skill, detailKey, onProgress }: { skill: any; detailKey: string; onProgress: (current: number, target: number, confidence: number) => void }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<any>(null);
  const [resourceMessage, setResourceMessage] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [newTask, setNewTask] = useState({ title: "", day: "1", minutes: "30" });
  const detail = useQuery<Envelope>({ queryKey: ["skill-detail", detailKey], queryFn: () => apiFetch(`/skills/${detailKey}/detail`), enabled: Boolean(detailKey) });
  const data = detail.data?.data || {};
  const currentSkill = data.skill || skill;
  const [current, setCurrent] = useState(Math.max(1, currentSkill.currentLevel || 1));
  const [target, setTarget] = useState(Math.max(1, currentSkill.targetLevel || 5));
  const [confidence, setConfidence] = useState(currentSkill.confidence || 0);

  useEffect(() => {
    setSearchQuery(""); setSearchResults([]); setKnowledgePoints([]); setQuestions([]); setAnswers([]); setAssessment(null); setResourceMessage(""); setPlanMessage("");
    setCurrent(Math.max(1, skill.currentLevel || 1)); setTarget(Math.max(1, skill.targetLevel || 5)); setConfidence(skill.confidence || 0);
  }, [detailKey, skill]);

  const generateKnowledge = useMutation({
    mutationFn: () => apiFetch<Envelope>(`/skills/${detailKey}/knowledge`, { method: "POST" }),
    onSuccess: (response) => setKnowledgePoints(response.data.knowledgePoints || []),
  });
  const generatePlan = useMutation<Envelope, Error>({
    mutationFn: () => apiFetch<Envelope>(`/skills/${detailKey}/plan`, { method: "POST", body: JSON.stringify({ weeklyMinutes: 420 }) }),
    onSuccess: (response) => { setPlanMessage(`已生成 ${response.data.tasks?.length || 0} 天计划。`); void queryClient.invalidateQueries({ queryKey: ["skill-detail", detailKey] }); },
    onError: (error) => setPlanMessage(error.message || "生成计划失败，请稍后重试。"),
  });
  const addTask = useMutation({
    mutationFn: () => apiFetch(`/planner/tasks`, { method: "POST", body: JSON.stringify({ title: newTask.title.trim(), day: Number(newTask.day), estimatedMinutes: Number(newTask.minutes), skillId: detailKey }) }),
    onSuccess: () => { setNewTask({ title: "", day: "1", minutes: "30" }); void queryClient.invalidateQueries({ queryKey: ["skill-detail", detailKey] }); },
  });
  const updateTask = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiFetch(`/planner/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skill-detail", detailKey] }),
  });
  const toggleTask = useMutation({
    mutationFn: (id: string) => apiFetch(`/planner/tasks/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skill-detail", detailKey] }),
  });
  const deleteTask = useMutation({
    mutationFn: (id: string) => apiFetch(`/planner/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["skill-detail", detailKey] }),
  });
  const saveResource = useMutation({ mutationFn: (resourceId: string) => apiFetch("/library/bookmarks", { method: "POST", body: JSON.stringify({ resourceId }) }) });
  const startAssessment = useMutation({
    mutationFn: () => apiFetch<Envelope>("/career/assessment", { method: "POST", body: JSON.stringify({ topic: currentSkill.name }) }),
    onSuccess: (response) => { const nextQuestions = response.data.questions || []; setQuestions(nextQuestions); setAnswers(nextQuestions.map(() => "")); setAssessment(null); },
  });
  const submitAssessment = useMutation({
    mutationFn: () => apiFetch<Envelope>("/career/assessment", { method: "POST", body: JSON.stringify({ topic: currentSkill.name, answers: questions.map((question, index) => ({ question: question.question, answer: answers[index] || "" })) }) }),
    onSuccess: (response) => setAssessment(response.data),
  });

  const searchResources = async () => {
    setSearching(true); setSearchResults([]); setResourceMessage("");
    try {
      const response = await apiFetch<Envelope>(`/skills/${detailKey}/resources`, { method: "POST", body: JSON.stringify({ query: searchQuery.trim(), limit: 12 }) });
      let finished = false;
      for (let index = 0; index < 30; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const job = await apiFetch<Envelope>(`/explore/jobs/${response.data.jobId}`);
        if (job.data.status === "succeeded") {
          const items = job.data.result.items || [];
          setSearchResults(items);
          setResourceMessage(items.length ? `找到 ${items.length} 个 B 站学习资源。` : "暂时没有找到资源，请换一个关键词重试。");
          finished = true;
          break;
        }
        if (job.data.status === "failed") {
          setResourceMessage(job.data.error || "B 站搜索失败，请稍后重试。");
          finished = true;
          break;
        }
      }
      if (!finished) setResourceMessage("搜索超时，请稍后重试。");
    } catch (error) {
      setResourceMessage(error instanceof Error ? error.message : "B 站搜索失败，请稍后重试。");
    } finally { setSearching(false); }
  };

  const progressPercent = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
  const masteryPercent = Number(currentSkill.masteryPercent ?? Math.min(100, current * 10));
  const dailyProgress = Array.from({ length: 7 }, (_, index) => {
    const dayTasks = (data.tasks || []).filter((task: any) => task.day === index + 1);
    return dayTasks.length ? Math.round((dayTasks.filter((task: any) => task.status === "done").length / dayTasks.length) * 100) : 0;
  });
  const progressOption = { xAxis: { type: "category", data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] }, yAxis: { type: "value", max: 100 }, tooltip: { valueSuffix: "%" }, series: [{ type: "bar", data: dailyProgress, itemStyle: { borderRadius: [6, 6, 0, 0] } }] };

  return (
    <Card className="space-y-5 p-4" key={detailKey}>
      <SectionHeader title={`${currentSkill.name} · 技能详情`} subtitle="点击技能后才显示等级、资源、考核和学习计划。" action={<Badge variant="ai"><Sparkles className="h-3.5 w-3.5" />AI 学习工作区</Badge>} />
      {detail.isLoading ? <Skeleton className="h-32" /> : <>
        <div className="grid gap-3 md:grid-cols-4">
          <Stat label="当前等级" value={`${current}/10`} />
          <Stat label="目标等级" value={`${target}/10`} />
          <Stat label="掌握度" value={`${masteryPercent}%`} />
          <Stat label="本周完成" value={`${data.planStats?.done || 0}/${data.planStats?.total || 0}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-4"><SectionHeader title="技能等级管理" subtitle="只管理当前选中的技能。" /><div className="space-y-3"><LevelSlider label="当前等级" value={current} onChange={setCurrent} /><LevelSlider label="目标等级" value={target} min={1} onChange={setTarget} /><LevelSlider label="信心度" value={confidence} max={100} onChange={setConfidence} /><Button size="sm" onClick={() => onProgress(current, target, confidence)}><Check className="h-3.5 w-3.5" />保存等级</Button></div></Card>
          <Card className="p-4"><SectionHeader title="技能进度可视化" subtitle="按周查看每天的学习计划完成率。" /><EChart option={progressOption} height={210} /></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4"><SectionHeader title="AI 需要掌握的知识点" action={<Button size="sm" variant="outline" onClick={() => generateKnowledge.mutate()} disabled={generateKnowledge.isPending}>{generateKnowledge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}生成知识点</Button>} />{knowledgePoints.length === 0 ? <p className="text-sm text-muted">点击生成，AI 会根据当前等级列出具体学习重点。</p> : <div className="space-y-2">{knowledgePoints.map((point: any, index: number) => <div key={`${point.title}-${index}`} className="rounded-xl bg-surface-muted/50 p-3"><p className="text-sm font-medium">{index + 1}. {point.title || point}</p>{point.description && <p className="mt-1 text-xs text-muted">{point.description}</p>}</div>)}</div>}</Card>
          <Card className="p-4"><SectionHeader title="B站学习资源" subtitle="只搜索哔哩哔哩视频。" action={<Button size="sm" variant="outline" onClick={() => void searchResources()} disabled={searching}>{searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}搜索B站</Button>} /><div className="flex gap-2"><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchResources(); }} placeholder={`搜索 ${currentSkill.name} 视频`} /><Badge variant="primary"><Video className="h-3.5 w-3.5" />B站</Badge></div>{resourceMessage && <p className="mt-3 text-xs text-muted">{resourceMessage}</p>}{searchResults.length > 0 && <div className="mt-3 space-y-2">{searchResults.map((resource: any) => <div key={resource.resourceId} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{resource.title}</p><Badge>{resource.sourceName || "哔哩哔哩"}</Badge></div><p className="mt-1 text-xs text-muted">{resource.description || "B站学习视频"}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" onClick={() => saveResource.mutate(resource.resourceId)}>收藏</Button><a href={resource.url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">打开视频<ExternalLink className="h-3 w-3" /></Button></a></div></div>)}</div>}{!searching && !resourceMessage && searchResults.length === 0 && <p className="mt-3 text-xs text-muted">输入关键词后搜索，只返回B站资源。</p>}</Card>
        </div>

        <Card className="p-4"><SectionHeader title="AI 学习考核" subtitle="根据当前技能生成题目，提交后自动评分。" action={<Button size="sm" variant="outline" onClick={() => startAssessment.mutate()} disabled={startAssessment.isPending}>{startAssessment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}生成考核题</Button>} />{questions.length > 0 && <div className="space-y-3">{questions.map((question, index) => <div key={`${question.question}-${index}`}><p className="text-xs font-medium">{index + 1}. {question.question}</p><Textarea className="mt-1 min-h-[60px]" value={answers[index] || ""} onChange={(event) => setAnswers((currentAnswers) => currentAnswers.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="写下你的理解、练习过程或结果" /></div>)}<Button size="sm" onClick={() => submitAssessment.mutate()} disabled={submitAssessment.isPending}>提交并评分</Button></div>}{assessment && <div className="mt-3 rounded-xl bg-success/10 p-4"><p className="text-2xl font-bold text-success">{assessment.score} 分</p><p className="mt-1 text-xs text-muted">{assessment.feedback}</p></div>}</Card>

        <Card className="p-4"><SectionHeader title="学习计划与进度" subtitle="AI 先生成当前技能的周计划，你也可以手动增删计划。" action={<Button size="sm" variant="primary" onClick={() => generatePlan.mutate()} disabled={generatePlan.isPending}>{generatePlan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}生成周计划</Button>} />{planMessage && <p className="mt-2 text-xs text-muted">{planMessage}</p>}<div className="grid gap-3 md:grid-cols-4"><Stat label="计划完成率" value={`${data.planStats?.completionRate || 0}%`} /><Stat label="已完成任务" value={`${data.planStats?.done || 0}`} /><Stat label="计划任务" value={`${data.planStats?.total || 0}`} /><Stat label="完成分钟" value={`${data.planStats?.completedMinutes || 0}`} /></div><div className="mt-4 flex flex-wrap gap-2"><Input className="min-w-[220px] flex-1" value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter" && newTask.title.trim()) addTask.mutate(); }} placeholder="添加一个学习计划" /><Input className="w-20" type="number" min="1" max="7" value={newTask.day} onChange={(event) => setNewTask({ ...newTask, day: event.target.value })} /><Input className="w-24" type="number" min="10" max="600" value={newTask.minutes} onChange={(event) => setNewTask({ ...newTask, minutes: event.target.value })} /><Button size="sm" onClick={() => addTask.mutate()} disabled={!newTask.title.trim() || addTask.isPending}><Plus className="h-3.5 w-3.5" />添加计划</Button></div><div className="mt-4 space-y-2">{(data.tasks || []).length === 0 ? <p className="text-sm text-muted">还没有计划，先让 AI 生成或手动添加一个。</p> : (data.tasks || []).map((task: any) => <PlanTaskRow key={task.id} task={task} onToggle={() => toggleTask.mutate(task.id)} onDelete={() => { if (window.confirm("删除这条学习计划？")) deleteTask.mutate(task.id); }} onSave={(payload) => updateTask.mutate({ id: task.id, payload })} />)}</div></Card>
      </>}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-muted/50 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>;
}

function LevelSlider({ label, value, min = 0, max = 10, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="block"><div className="mb-1 flex justify-between text-xs text-muted"><span>{label}</span><span>{value}</span></div><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--primary)]" /></label>;
}

function PlanTaskRow({ task, onToggle, onDelete, onSave }: { task: any; onToggle: () => void; onDelete: () => void; onSave: (payload: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [day, setDay] = useState(String(task.day));
  const [minutes, setMinutes] = useState(String(task.estimatedMinutes));
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"><button type="button" className={`flex h-7 w-7 items-center justify-center rounded-full border ${task.status === "done" ? "border-success bg-success text-white" : "border-border"}`} onClick={onToggle}><Check className="h-3.5 w-3.5" /></button>{editing ? <><Input className="min-w-[180px] flex-1" value={title} onChange={(event) => setTitle(event.target.value)} /><Input className="w-16" type="number" min="1" max="7" value={day} onChange={(event) => setDay(event.target.value)} /><Input className="w-20" type="number" min="10" max="600" value={minutes} onChange={(event) => setMinutes(event.target.value)} /><Button size="sm" onClick={() => { onSave({ title: title.trim(), day: Number(day), estimatedMinutes: Number(minutes) }); setEditing(false); }}>保存</Button></> : <><div className="min-w-[180px] flex-1"><p className={task.status === "done" ? "text-sm line-through text-muted" : "text-sm"}>{task.title}</p><p className="mt-1 text-xs text-muted">周{task.day} · {task.estimatedMinutes} 分钟</p></div><Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />修改</Button></>}<Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button></div>;
}
