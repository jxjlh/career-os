"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, CircleDashed, Clock, Plus, Sparkles, Trash2, Camera, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import {
  CATEGORY_META,
  createLifeGoal,
  deleteLifeGoal,
  getCategoryMeta,
  getGoalRecords,
  type LifeGoal,
  type LifeGoalInput,
} from "@/lib/life";
import { apiFetch } from "@/lib/api";

interface LifeGoalBoardProps {
  goals: LifeGoal[];
}

function GoalColumn({
  title,
  icon,
  goals,
  tone,
  onSelect,
  selectedId,
}: {
  title: string;
  icon: React.ReactNode;
  goals: LifeGoal[];
  tone: "slate" | "emerald" | "sky";
  onSelect?: (goal: LifeGoal) => void;
  selectedId?: string | null;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
      : tone === "sky"
        ? "border-sky-500/25 bg-sky-500/5 text-sky-600 dark:text-sky-400"
        : "border-slate-500/25 bg-slate-500/5 text-slate-600 dark:text-slate-300";
  return (
    <div className="flex min-h-[240px] flex-col rounded-[12px] border border-border bg-surface/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
          {icon}
          {title}
        </span>
        <span className="text-xs font-bold text-muted">{goals.length}</span>
      </div>
      <div className="flex-1 space-y-2">
        {goals.length === 0 && (
          <p className="rounded-[8px] border border-dashed border-border p-4 text-center text-xs text-muted">
            还没有目标
          </p>
        )}
        {goals.map((goal) => {
          const card = (
            <>
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">{getCategoryMeta(goal.category).icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{goal.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                    {goal.description || "还没有描述"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {goal.location && <Badge>{goal.location}</Badge>}
                    {goal.targetDate && <Badge>{goal.targetDate}</Badge>}
                    {goal.budget && <Badge variant="warning">预算 {goal.budget}</Badge>}
                    {goal.bestSeason && <Badge variant="success">{goal.bestSeason}</Badge>}
                  </div>
                </div>
              </div>
              {goal.status !== "completed" && (
                <span className="mt-2 flex items-center gap-0.5 text-[10px] font-medium text-primary">
                  查看详情
                  <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </>
          );

          if (goal.status === "completed") {
            return (
              <div
                key={goal.id}
                className={`cursor-pointer rounded-[10px] border p-3 transition-colors ${
                  selectedId === goal.id
                    ? "border-primary/50 bg-primary/8"
                    : "border-border bg-surface hover:border-primary/30"
                }`}
                onClick={() => onSelect?.(goal)}
              >
                {card}
              </div>
            );
          }

          return (
            <Link
              key={goal.id}
              href={`/life/goals/detail?id=${goal.id}`}
              className={`block rounded-[10px] border p-3 transition-colors ${
                selectedId === goal.id
                  ? "border-primary/50 bg-primary/8"
                  : "border-border bg-surface hover:border-primary/30"
              }`}
            >
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function CompletedGoalDetail({ goal, onDeleteGoal }: { goal: LifeGoal; onDeleteGoal: () => void }) {
  const records = useQuery({
    queryKey: ["life-goal-records", goal.id],
    queryFn: () => getGoalRecords(goal.id),
    enabled: Boolean(goal.id),
  });
  const items = records.data || [];
  const first = items[0];
  const queryClient = useQueryClient();
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [reflection, setReflection] = useState("");
  
  const deleteGoalMutation = useMutation({
    mutationFn: () => deleteLifeGoal(goal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      onDeleteGoal();
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/life/goals/${goal.id}/records`, {
        method: "POST",
        body: JSON.stringify({ content: reflection }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-goal-records", goal.id] });
      setReflection("");
      setShowAddRecord(false);
    },
  });

  return (
    <Card className="mt-3 overflow-hidden border-primary/25 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">完成详情</p>
        <div className="flex items-center gap-2">
          <Link href={`/life/goals/${goal.id}`} className="text-xs font-medium text-primary">
            查看完整目标 →
          </Link>
          <button
            onClick={() => {
              if (confirm("确定要删除这个目标吗？")) {
                deleteGoalMutation.mutate();
              }
            }}
            className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400"
            title="删除目标"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
        {first?.watermarkUrl || first?.photoUrl ? (
          <div className="overflow-hidden rounded-[10px] border border-border">
            <LifeRecordImage path={first.watermarkUrl || first.photoUrl!} />
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-[10px] bg-surface-muted text-2xl">📷</div>
        )}
        <div className="space-y-2">
          {first ? (
            <>
              <p className="text-[13px]">
                完成时间：{first.createdAt?.replace("T", " ").slice(0, 16) || "未记录"}
              </p>
              <p className="text-[13px]">
                地点：{[first.country, first.city, goal.location].filter(Boolean).join(" · ") || "未记录"}
              </p>
              {first.content && <p className="rounded-[8px] bg-surface-muted p-2.5 text-[12px] text-muted">{first.content}</p>}
            </>
          ) : (
            <p className="text-[13px] text-muted">该目标已标记完成，还没有照片记录。</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="success">已完成</Badge>
            {goal.friends && goal.friends.length > 0 && (
              <Badge variant="primary">👥 {goal.friends.length} 位好友同行</Badge>
            )}
          </div>
        </div>
      </div>
      {items.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {items.slice(0, 4).map((record) => (
            <Link key={record.id} href={`/life/records/${record.id}`} className="overflow-hidden rounded-[8px] border border-border">
              {record.thumbnailUrl || record.photoUrl || record.watermarkUrl ? (
                <LifeRecordImage path={record.thumbnailUrl || record.photoUrl || record.watermarkUrl!} />
              ) : (
                <div className="flex h-14 items-center justify-center bg-surface-muted text-xs text-muted">{record.recordType}</div>
              )}
            </Link>
          ))}
        </div>
      )}
      
      {/* 添加感受/照片/视频 */}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-text-secondary">添加完成感受</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowAddRecord(!showAddRecord)}
          >
            {showAddRecord ? "取消" : "+ 添加"}
          </Button>
        </div>
        
        {showAddRecord && (
          <div className="space-y-3">
            <Textarea
              rows={3}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="分享一下你的完成感受、心得体会..."
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // 这里可以实现拍照/上传功能
                  alert("拍照功能需要在目标详情页使用");
                }}
              >
                <Camera className="h-4 w-4 mr-1" />
                拍照
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // 这里可以实现上传图片功能
                  alert("上传图片功能需要在目标详情页使用");
                }}
              >
                <ImageIcon className="h-4 w-4 mr-1" />
                上传图片
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => addRecordMutation.mutate()}
                disabled={!reflection.trim() || addRecordMutation.isPending}
                className="ml-auto"
              >
                {addRecordMutation.isPending ? "保存中..." : "保存感受"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function LifeGoalBoard({ goals }: LifeGoalBoardProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedCompleted, setSelectedCompleted] = useState<string | null>(null);
  const [newCategoryMode, setNewCategoryMode] = useState(false);
  const [form, setForm] = useState<LifeGoalInput>({ title: "", category: "travel" });

  const total = goals.length;
  const completed = useMemo(() => goals.filter((g) => g.status === "completed"), [goals]);
  const incomplete = useMemo(
    () => goals.filter((g) => g.status !== "completed" && g.status !== "cancelled"),
    [goals],
  );
  const customCategories = useMemo(
    () =>
      Array.from(
        new Set(
          goals
            .map((g) => g.category)
            .filter((category): category is string => Boolean(category) && !CATEGORY_META[category]),
        ),
      ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [goals],
  );

  const createMutation = useMutation({
    mutationFn: () => createLifeGoal(form),
    onSuccess: () => {
      setCreating(false);
      setNewCategoryMode(false);
      setForm({ title: "", category: "travel" });
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
    },
  });

  const set = <K extends keyof LifeGoalInput>(key: K, value: LifeGoalInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleCategoryChange = (value: string) => {
    if (value === "__new__") {
      setNewCategoryMode(true);
      set("category", "");
    } else {
      setNewCategoryMode(false);
      set("category", value);
    }
  };

  const selectedGoal = completed.find((g) => g.id === selectedCompleted) || null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <GoalColumn
          title="总目标"
          icon={<CircleDashed className="h-3.5 w-3.5" />}
          goals={goals}
          tone="slate"
          onSelect={(goal) => {
            if (goal.status === "completed") {
              setSelectedCompleted((prev) => (prev === goal.id ? null : goal.id));
            }
          }}
          selectedId={selectedCompleted}
        />
        <GoalColumn
          title="已完成"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          goals={completed}
          tone="emerald"
          onSelect={(goal) => setSelectedCompleted((prev) => (prev === goal.id ? null : goal.id))}
          selectedId={selectedCompleted}
        />
        <GoalColumn
          title="未完成"
          icon={<Clock className="h-3.5 w-3.5" />}
          goals={incomplete}
          tone="sky"
          onSelect={(goal) => setSelectedCompleted(null)}
        />
      </div>

      {selectedGoal && <CompletedGoalDetail goal={selectedGoal} onDeleteGoal={() => setSelectedCompleted(null)} />}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">第一个人生目标，从今天开始</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {total === 0
              ? "创建旅行、技能、健康或关系目标，开始记录你的人生进度。"
              : `已完成 ${completed.length} / ${total} 个目标，未完成 ${incomplete.length} 个。`}
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" />
          新建人生目标
        </Button>
      </Card>

      {creating && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">目标名称</label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="如：去冰岛看极光" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">分类</label>
              <select
                className="h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm"
                value={newCategoryMode ? "__new__" : form.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.icon} {meta.labelZh}
                  </option>
                ))}
                {customCategories.map((category) => (
                  <option key={category} value={category}>
                    ✨ {category}
                  </option>
                ))}
                <option value="__new__">✨ 新建分类…</option>
              </select>
              {newCategoryMode && (
                <Input
                  className="mt-2"
                  value={form.category || ""}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="输入新分类名称，如 家庭"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">目标日期</label>
              <Input type="date" value={form.targetDate || ""} onChange={(e) => set("targetDate", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">地点</label>
              <Input value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">预算</label>
              <Input value={form.budget || ""} onChange={(e) => set("budget", e.target.value)} placeholder="如 10000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">推荐天数</label>
              <Input
                type="number"
                min={1}
                value={form.recommendedDays || ""}
                onChange={(e) => set("recommendedDays", Number(e.target.value) || undefined)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">最佳季节</label>
              <Input value={form.bestSeason || ""} onChange={(e) => set("bestSeason", e.target.value)} placeholder="如 6-9月" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">描述</label>
              <Textarea rows={3} value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.title.trim() || !form.category.trim() || createMutation.isPending}
            >
              <Sparkles className="h-4 w-4" />
              创建目标
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
