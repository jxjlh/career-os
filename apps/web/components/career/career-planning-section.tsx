"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Edit3,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EChart } from "@/components/chart";
import { Badge, Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getLifeGoals, type LifeGoal } from "@/lib/life";

type Envelope = { data: any };
type SuggestionItem = { title: string; reason: string; action: string; resources: string[]; weeks: number };
type AssessmentQuestion = { question: string; rubric?: string };

const dayNames = ["一", "二", "三", "四", "五", "六", "日"];

export function CareerPlanningSection({ showHeader = true }: { showHeader?: boolean }) {
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("10");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [resourceStatus, setResourceStatus] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDay, setTaskDay] = useState("1");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("自定义");
  const [assessmentTopic, setAssessmentTopic] = useState("");
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentAnswers, setAssessmentAnswers] = useState<string[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  const goals = useQuery<LifeGoal[]>({ queryKey: ["life-goals"], queryFn: getLifeGoals });
  const matrix = useQuery<Envelope>({ queryKey: ["skill-matrix"], queryFn: () => apiFetch("/skills/matrix") });
  const plan = useQuery<Envelope>({ queryKey: ["planner-current"], queryFn: () => apiFetch("/planner/current") });
  const skillItems = matrix.data?.data.items || [];
  const planData = plan.data?.data;
  const tasks = planData?.tasks || [];

  useEffect(() => {
    if (selectedSkills.length === 0 && skillItems.length > 0) {
      setSelectedSkills(skillItems.filter((skill: any) => skill.targetLevel > 0).map((skill: any) => skill.skillId));
    }
  }, [skillItems, selectedSkills.length]);

  const selectedGoalTitles = useMemo(
    () => (goals.data || []).filter((goal) => selectedGoals.includes(goal.id)).map((goal) => goal.title),
    [goals.data, selectedGoals],
  );
  const selectedSkillNames = useMemo(
    () => skillItems.filter((skill: any) => selectedSkills.includes(skill.skillId)).map((skill: any) => skill.name),
    [skillItems, selectedSkills],
  );

  const generateSuggestions = useMutation({
    mutationFn: () =>
      apiFetch<Envelope>("/career/suggestions", {
        method: "POST",
        body: JSON.stringify({
          currentSituation: [situation, `当前目标: ${selectedGoalTitles.join("、") || "未选择"}`, `重点技能: ${selectedSkillNames.join("、") || "未选择"}`].join("\n"),
          targetRole: targetRole || selectedGoalTitles[0] || null,
          weeklyHours: Number(weeklyHours) || 10,
        }),
      }),
    onSuccess: (response) => setSuggestions(response.data.suggestions || []),
  });

  const generatePlan = useMutation({
    mutationFn: () =>
      apiFetch<Envelope>("/planner/generate", {
        method: "POST",
        body: JSON.stringify({
          weeklyStudyMinutes: Math.max(60, (Number(weeklyHours) || 10) * 60),
          prioritySkills: selectedSkills,
          goalIds: selectedGoals,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const addTask = useMutation({
    mutationFn: ({ title, day }: { title: string; day: number }) =>
      apiFetch("/planner/tasks", {
        method: "POST",
        body: JSON.stringify({ title, day, estimatedMinutes: 60 }),
      }),
    onSuccess: () => {
      setTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
    },
  });

  const toggleTask = useMutation({
    mutationFn: (taskId: string) => apiFetch(`/planner/tasks/${taskId}/toggle`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const createSkill = useMutation({
    mutationFn: () => apiFetch("/skills", { method: "POST", body: JSON.stringify({ name: newSkillName.trim(), category: newSkillCategory.trim() || "自定义" }) }),
    onSuccess: () => {
      setNewSkillName("");
      queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
    },
  });

  const updateSkill = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiFetch(`/skills/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skill-matrix"] }),
  });

  const deleteSkill = useMutation({
    mutationFn: (id: string) => apiFetch(`/skills/${id}`, { method: "DELETE" }),
    onSuccess: (_data, deletedSkillId) => {
      queryClient.invalidateQueries({ queryKey: ["skill-matrix"] });
      setSelectedSkills((current) => current.filter((skillId) => skillId !== deletedSkillId));
    },
  });

  const startAssessment = useMutation({
    mutationFn: () => apiFetch<Envelope>("/career/assessment", { method: "POST", body: JSON.stringify({ topic: assessmentTopic.trim() || selectedSkillNames[0] || targetRole || "当前学习内容" }) }),
    onSuccess: (response) => {
      const questions = response.data.questions || [];
      setAssessmentQuestions(questions);
      setAssessmentAnswers(questions.map(() => ""));
      setAssessmentResult(null);
    },
  });

  const submitAssessment = useMutation({
    mutationFn: () =>
      apiFetch<Envelope>("/career/assessment", {
        method: "POST",
        body: JSON.stringify({
          topic: assessmentTopic.trim() || selectedSkillNames[0] || targetRole || "当前学习内容",
          answers: assessmentQuestions.map((question, index) => ({ question: question.question, answer: assessmentAnswers[index] || "" })),
        }),
      }),
    onSuccess: (response) => setAssessmentResult(response.data),
  });

  const searchResources = async (item: SuggestionItem) => {
    setResourceStatus(`正在为“${item.title}”搜索学习资源…`);
    try {
      await apiFetch("/explore/search", { method: "POST", body: JSON.stringify({ query: `${item.title} ${item.resources?.join(" ") || ""}`, limit: 10 }) });
      setResourceStatus("资源搜索已加入后台任务，可在资源探索中查看结果。 ");
    } catch {
      setResourceStatus("资源搜索暂时失败，请稍后重试。 ");
    }
  };

  const radarOption = {
    tooltip: {},
    radar: { indicator: skillItems.slice(0, 8).map((skill: any) => ({ name: skill.name, max: 10 })), radius: "65%" },
    series: [{ type: "radar", data: [{ value: skillItems.slice(0, 8).map((skill: any) => skill.currentLevel || 0), name: "当前水平", areaStyle: { opacity: 0.18 } }, { value: skillItems.slice(0, 8).map((skill: any) => skill.targetLevel || 0), name: "目标水平" }] }],
    legend: { bottom: 0, textStyle: { color: "var(--muted)" } },
  };
  const completedTasks = tasks.filter((task: any) => task.status === "done").length;
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="space-y-5">
      {showHeader && <SectionHeader title="成长中心" subtitle="同时推进多个目标，把学习、资源、计划和考察串成一条闭环。" />}

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">1. 选择目标与技能</h2><p className="mt-1 text-xs text-muted">可以同时选择多个目标和技能，AI 会按优先级生成任务。</p></div>
          <div className="flex gap-2"><Link href="/life"><Button variant="outline" size="sm">管理人生目标</Button></Link><Link href="/skills"><Button variant="outline" size="sm">打开技能矩阵</Button></Link></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div><p className="mb-2 text-xs font-medium text-muted">人生目标（多选）</p><div className="flex flex-wrap gap-2">{(goals.data || []).filter((goal) => goal.status !== "completed").map((goal) => <button key={goal.id} type="button" onClick={() => toggleSelection(setSelectedGoals, goal.id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedGoals.includes(goal.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/40"}`}>{selectedGoals.includes(goal.id) ? <Check className="mr-1 inline h-3 w-3" /> : null}{goal.title}</button>)}</div>{(goals.data || []).length === 0 && <p className="text-xs text-muted">还没有目标，先去添加一个目标。</p>}</div>
          <div><p className="mb-2 text-xs font-medium text-muted">学习技能（多选）</p><div className="flex flex-wrap gap-2">{skillItems.map((skill: any) => <button key={skill.skillId} type="button" onClick={() => toggleSelection(setSelectedSkills, skill.skillId)} className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedSkills.includes(skill.skillId) ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-border text-muted hover:border-cyan-400/40"}`}>{selectedSkills.includes(skill.skillId) ? <Check className="mr-1 inline h-3 w-3" /> : null}{skill.name}</button>)}</div></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
          <Input value={newSkillName} onChange={(event) => setNewSkillName(event.target.value)} placeholder="添加自定义技能，如：短视频剪辑" />
          <Input value={newSkillCategory} onChange={(event) => setNewSkillCategory(event.target.value)} placeholder="技能分类" />
          <Button size="sm" variant="outline" disabled={!newSkillName.trim() || createSkill.isPending} onClick={() => createSkill.mutate()}><Plus className="h-4 w-4" />添加技能</Button>
        </div>
        {skillItems.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{skillItems.filter((skill: any) => selectedSkills.includes(skill.skillId)).map((skill: any) => <span key={skill.skillId} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] text-muted">{skill.name}<button type="button" title="修改技能名称" onClick={() => { const name = window.prompt("修改技能名称", skill.name)?.trim(); if (name && name !== skill.name) updateSkill.mutate({ id: skill.skillId, name }); }}><Edit3 className="h-3 w-3" /></button><button type="button" title="删除技能" onClick={() => { if (window.confirm(`删除技能“${skill.name}”？`)) deleteSkill.mutate(skill.skillId); }}><Trash2 className="h-3 w-3 text-danger" /></button></span>)}</div>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-ai" /><h2 className="text-sm font-semibold">2. AI 推荐学习任务与资源</h2></div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_100px_auto]">
          <Textarea className="min-h-[80px] lg:col-span-2" value={situation} onChange={(event) => setSituation(event.target.value)} placeholder="描述你的当前基础、学习时间和想解决的问题" />
          <Input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="目标岗位/方向" />
          <div className="flex gap-2"><Input type="number" min="1" max="168" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} placeholder="小时" /><Button size="sm" disabled={!situation.trim() || generateSuggestions.isPending} onClick={() => generateSuggestions.mutate()}>{generateSuggestions.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}生成</Button></div>
        </div>
        {resourceStatus && <p className="mt-2 text-xs text-primary">{resourceStatus}<Link className="ml-1 underline" href="/explore">打开资源探索</Link></p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">{suggestions.map((item) => <div key={item.title} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{item.title}</h3><Badge variant="ai">{item.weeks} 周</Badge></div><p className="mt-1 text-xs text-muted">{item.reason}</p><p className="mt-2 text-xs leading-relaxed">{item.action}</p><div className="mt-2 flex flex-wrap gap-1">{(item.resources || []).map((resource) => <Badge key={resource}>{resource}</Badge>)}</div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => addTask.mutate({ title: item.title, day: Number(taskDay) })} disabled={addTask.isPending}><Plus className="h-3.5 w-3.5" />加入计划</Button><Button size="sm" variant="outline" onClick={() => searchResources(item)}><Search className="h-3.5 w-3.5" />搜索资源</Button></div></div>)}</div>
        {suggestions.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted">生成建议后，这里会出现可直接加入周计划的学习任务。</p>}
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">3. AI 周计划与每日执行</h2><p className="mt-1 text-xs text-muted">每次生成都会绑定当前选中的多个目标和技能。</p></div><Button size="sm" disabled={generatePlan.isPending} onClick={() => generatePlan.mutate()}>{generatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}生成本周计划</Button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted">本周任务</p><p className="mt-1 text-xl font-bold">{tasks.length}</p></div><div className="rounded-xl bg-success/10 p-3"><p className="text-xs text-muted">已完成</p><p className="mt-1 text-xl font-bold text-success">{completedTasks}</p></div><div className="rounded-xl bg-ai/10 p-3"><p className="text-xs text-muted">完成率</p><p className="mt-1 text-xl font-bold text-ai">{completionRate}%</p></div></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 7 }, (_, index) => <div key={index} className="min-h-[110px] rounded-xl border border-border p-3"><p className="text-xs font-semibold">周{dayNames[index]}</p><div className="mt-2 space-y-2">{tasks.filter((task: any) => task.day === index + 1).map((task: any) => <button key={task.id} type="button" onClick={() => toggleTask.mutate(task.id)} className="flex w-full items-start gap-2 text-left text-xs"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${task.status === "done" ? "border-success bg-success text-white" : "border-border"}`}>{task.status === "done" ? <Check className="h-3 w-3" /> : null}</span><span className={task.status === "done" ? "text-muted line-through" : ""}>{task.title}</span></button>)}</div></div>)}</div>
        <div className="mt-4 flex gap-2"><Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="自定义学习内容，如：完成一个 SQL 练习" /><select value={taskDay} onChange={(event) => setTaskDay(event.target.value)} className="h-10 rounded-[10px] border border-border bg-surface px-2 text-xs"><option value="1">周一</option><option value="2">周二</option><option value="3">周三</option><option value="4">周四</option><option value="5">周五</option><option value="6">周六</option><option value="7">周日</option></select><Button size="sm" variant="outline" disabled={!taskTitle.trim() || addTask.isPending} onClick={() => addTask.mutate({ title: taskTitle.trim(), day: Number(taskDay) })}><Plus className="h-4 w-4" />添加</Button></div>
        <Link href="/planner" className="mt-3 inline-block text-xs text-primary hover:underline">进入完整计划页管理任务 →</Link>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">4. 学习考察与 AI 打分</h2></div>
        <div className="mt-3 flex flex-wrap gap-2"><Input className="max-w-sm" value={assessmentTopic} onChange={(event) => setAssessmentTopic(event.target.value)} placeholder={`考察内容，如：${selectedSkillNames[0] || "当前学习技能"}`} /><Button size="sm" onClick={() => startAssessment.mutate()} disabled={startAssessment.isPending}>{startAssessment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "生成考察题"}</Button></div>
        {assessmentQuestions.length > 0 && <div className="mt-4 space-y-3">{assessmentQuestions.map((question, index) => <div key={`${question.question}-${index}`}><p className="text-xs font-medium">{index + 1}. {question.question}</p><Textarea className="mt-1 min-h-[60px]" value={assessmentAnswers[index] || ""} onChange={(event) => setAssessmentAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="写下你的答案或实践结果" /></div>)}<Button size="sm" onClick={() => submitAssessment.mutate()} disabled={submitAssessment.isPending}>{submitAssessment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交并评分"}</Button></div>}
        {assessmentResult && <div className="mt-4 rounded-xl bg-success/10 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">本次得分</p><p className="text-2xl font-bold text-success">{assessmentResult.score}</p></div><p className="mt-1 text-xs text-muted">{assessmentResult.feedback}</p></div>}
      </Card>

      <Card className="p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">5. 成长可视化</h2><p className="mt-1 text-xs text-muted">技能差距与计划完成率会随着执行实时更新。</p></div><Target className="h-5 w-5 text-primary" /></div><EChart option={radarOption} height={280} /></Card>
    </div>
  );
}
