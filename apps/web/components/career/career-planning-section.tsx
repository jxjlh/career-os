"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  FileText,
  GraduationCap,
  Library,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EChart } from "@/components/chart";
import { Badge, Button, Card, Input, SectionHeader, Skeleton, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type Envelope = { data: any };

interface SuggestionItem {
  title: string;
  reason: string;
  action: string;
  resources: string[];
  weeks: number;
}

export function CareerPlanningSection({ showHeader = true }: { showHeader?: boolean }) {
  const queryClient = useQueryClient();
  const [situation, setSituation] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("10");
  const [suggestions, setSuggestions] = useState<SuggestionItem[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDay, setTaskDay] = useState("1");

  const profile = useQuery<Envelope>({
    queryKey: ["career-profile"],
    queryFn: () => apiFetch("/profile"),
  });
  const matrix = useQuery<Envelope>({
    queryKey: ["skill-matrix"],
    queryFn: () => apiFetch("/skills/matrix"),
  });
  const plan = useQuery<Envelope>({
    queryKey: ["planner-current"],
    queryFn: () => apiFetch("/planner/current"),
  });

  const generateSuggestions = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { suggestions: SuggestionItem[] } }>("/career/suggestions", {
        method: "POST",
        body: JSON.stringify({
          currentSituation: situation,
          targetRole,
          weeklyHours: Number(weeklyHours) || 10,
        }),
      }),
    onSuccess: (res) => setSuggestions(res.data.suggestions),
  });

  const generatePlan = useMutation({
    mutationFn: () =>
      apiFetch("/planner/generate", {
        method: "POST",
        body: JSON.stringify({ weeklyStudyMinutes: Number(weeklyHours) * 60 || 420 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["planner-current"] }),
  });

  const addTask = useMutation({
    mutationFn: () =>
      apiFetch("/planner/tasks", {
        method: "POST",
        body: JSON.stringify({ title: taskTitle, day: Number(taskDay) || 1, estimatedMinutes: 60 }),
      }),
    onSuccess: () => {
      setTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["planner-current"] });
    },
  });

  const items = matrix.data?.data?.items || [];
  const radarOption = {
    tooltip: {},
    radar: {
      indicator: items.slice(0, 6).map((s: any) => ({ name: s.name, max: 10 })),
      radius: "62%",
      splitArea: { areaStyle: { color: ["var(--surface)", "var(--surface-muted)"] } },
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: items.slice(0, 6).map((s: any) => s.currentLevel || 0),
            name: "当前",
            areaStyle: { opacity: 0.16 },
            lineStyle: { color: "#2563EB" },
          },
          {
            value: items.slice(0, 6).map((s: any) => s.targetLevel || 0),
            name: "目标",
            lineStyle: { color: "#16A34A" },
          },
        ],
      },
    ],
    legend: { bottom: 0, textStyle: { color: "var(--muted)" } },
  };

  const planTasks = plan.data?.data?.tasks || [];
  const profileData = profile.data?.data;
  const defaultSituation =
    [
      profileData?.bio,
      profileData?.currentStage ? `当前阶段：${profileData.currentStage}` : "",
      profileData?.careerDirection ? `职业方向：${profileData.careerDirection}` : "",
    ]
      .filter(Boolean)
      .join("\n") || "";

  const quickLinks = [
    { href: "/skills", label: "技能矩阵", icon: Target },
    { href: "/planner", label: "学习计划", icon: CalendarDays },
    { href: "/library", label: "资源库", icon: Library },
    { href: "/projects", label: "作品集", icon: Briefcase },
    { href: "/resume", label: "简历", icon: GraduationCap },
    { href: "/interviews", label: "面试中心", icon: ListChecks },
    { href: "/coach", label: "AI 教练", icon: Sparkles },
    { href: "/explore", label: "学习搜索", icon: BookOpen },
  ];

  return (
    <div className="space-y-5">
      {showHeader && (
        <SectionHeader
          title="职业规划"
          subtitle="描述现状 → AI 生成学习建议 → 制定计划 → 检测成长 → 准备面试"
        />
      )}

      {/* 现状描述 + AI 建议 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">描述我的现状</h2>
          </div>
          <p className="mt-1 text-[12px] text-muted">AI 会根据你的描述生成学习建议。</p>
          <div className="mt-3 space-y-3">
            <Textarea
              rows={4}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder={defaultSituation || "如：我是市场营销新人，会做基础投放，想转数据增长方向，每天有 2 小时学习时间。"}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="目标岗位（可选）" />
              <Input
                type="number"
                min={1}
                max={168}
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="每周可投入小时"
              />
            </div>
            <Button
              className="w-full"
              disabled={generateSuggestions.isPending || !situation.trim()}
              onClick={() => generateSuggestions.mutate()}
            >
              {generateSuggestions.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI 生成学习建议
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <h2 className="text-sm font-semibold">AI 学习建议</h2>
            {suggestions && <Badge variant="success">{suggestions.length} 条</Badge>}
          </div>
          {suggestions ? (
            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {suggestions.map((item, idx) => (
                <div key={item.title + idx} className="rounded-[10px] border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold">
                      <span className="mr-1.5 text-primary">0{idx + 1}</span>
                      {item.title}
                    </p>
                    <Badge>{item.weeks} 周</Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{item.reason}</p>
                  <p className="mt-1 text-[12px]">{item.action}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(item.resources || []).map((r) => (
                      <Badge key={r} variant="ai">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-44 flex-col items-center justify-center rounded-[10px] border border-dashed border-border text-center">
              <Sparkles className="mb-2 h-6 w-6 text-ai" />
              <p className="text-[13px] font-medium">先描述你的现状</p>
              <p className="mt-1 max-w-xs text-[12px] text-muted">生成后建议会展示在这里，也可以直接转到周计划手动添加学习内容。</p>
            </div>
          )}
        </Card>
      </div>

      {/* 技能矩阵 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">技能矩阵</h2>
            <p className="mt-0.5 text-[12px] text-muted">当前水平与目标水平的多维对比。</p>
          </div>
          <Link href="/skills">
            <Button variant="outline" size="sm">
              调整技能维度 →
            </Button>
          </Link>
        </div>
        {matrix.isLoading ? <Skeleton className="mt-3 h-56" /> : <EChart option={radarOption} height={260} />}
      </Card>

      {/* 学习计划 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">学习计划</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              AI 生成计划，或手动添加自己的学习内容。
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/planner">
              <Button variant="outline" size="sm">
                查看完整周计划 →
              </Button>
            </Link>
            <Button size="sm" onClick={() => generatePlan.mutate()} disabled={generatePlan.isPending}>
              {generatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI 生成计划
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="手动添加学习内容，如：学习 SQL 窗口函数"
          />
          <select
            className="h-10 rounded-[10px] border border-border bg-surface/80 px-3 text-sm"
            value={taskDay}
            onChange={(e) => setTaskDay(e.target.value)}
          >
            {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                周{d === 7 ? "日" : "一二三四五六"[d - 1]}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => addTask.mutate()} disabled={!taskTitle.trim() || addTask.isPending}>
            <Plus className="h-4 w-4" />
            添加
          </Button>
        </div>
        {plan.isLoading ? (
          <Skeleton className="mt-3 h-20" />
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {planTasks.slice(0, 8).map((task: any) => (
              <div key={task.id} className="rounded-[10px] border border-border bg-surface p-3">
                <p className="text-[13px] font-medium leading-snug">{task.title}</p>
                <p className="mt-1 text-[11px] text-muted">
                  周{task.day === 7 ? "日" : "一二三四五六"[task.day - 1]} · {task.estimatedMinutes} 分钟
                </p>
              </div>
            ))}
            {planTasks.length === 0 && (
              <p className="rounded-[10px] border border-dashed border-border p-4 text-[12px] text-muted">
                还没有计划任务，AI 生成或手动添加后这里会亮起来。
              </p>
            )}
          </div>
        )}
      </Card>

      {/* 快捷入口 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">更多职业工具</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-[10px] border border-border bg-surface/70 p-3 text-[13px] font-medium transition-colors hover:border-primary/35"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
