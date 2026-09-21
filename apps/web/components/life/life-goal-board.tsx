"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, CircleDashed, Clock, Loader2, MapPin, Plus, Sparkles, Trash2, Camera, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import { buildCategoryValues, getCategoryFields } from "@/lib/life-fields";
import { formatPlace, getLocationState, reverseGeocode } from "@/lib/location";
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

/**
 * 删除人生目标（带二次确认）。
 * 删掉后目标下的记录会级联删除，所以要把目标/地图/看板缓存一起失效。
 */
function DeleteGoalButton({
  goalId,
  title,
  onDeleted,
  className = "",
}: {
  goalId: string;
  title: string;
  onDeleted?: () => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deleteLifeGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-goal-suggestions"] });
      onDeleted?.();
    },
    onError: (e: Error) => alert(e.message || "删除失败，请稍后重试"),
  });

  return (
    <button
      type="button"
      title="删除目标"
      aria-label={`删除目标「${title}」`}
      disabled={mutation.isPending}
      onClick={(e) => {
        // 卡片本身是 Link / 可点击区域，这里必须阻止冒泡，否则会跳详情页
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`确定要删除「${title}」吗？\n该目标下的记录也会一并删除。`)) {
          mutation.mutate();
        }
      }}
      className={`shrink-0 rounded-[6px] p-1 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 ${className}`}
    >
      {mutation.isPending ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  );
}

function GoalColumn({
  title,
  icon,
  goals,
  tone,
  onSelect,
  selectedId,
  onGoalDeleted,
}: {
  title: string;
  icon: React.ReactNode;
  goals: LifeGoal[];
  tone: "slate" | "emerald" | "sky";
  onSelect?: (goal: LifeGoal) => void;
  selectedId?: string | null;
  onGoalDeleted?: (goalId: string) => void;
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
                <DeleteGoalButton
                  goalId={goal.id}
                  title={goal.title}
                  onDeleted={() => onGoalDeleted?.(goal.id)}
                />
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
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [reflection, setReflection] = useState("");
  const queryClient = useQueryClient();

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
          <DeleteGoalButton goalId={goal.id} title={goal.title} onDeleted={onDeleteGoal} />
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
  const [locating, setLocating] = useState(false);
  /** 分类专属字段的输入缓存（含列字段），key = `${category}:${fieldKey}` */
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

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
    mutationFn: () => createLifeGoal(buildInput()),
    onSuccess: () => {
      setCreating(false);
      setNewCategoryMode(false);
      setForm({ title: "", category: "travel" });
      setCustomValues({});
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
    },
  });

  const set = <K extends keyof LifeGoalInput>(key: K, value: LifeGoalInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /**
   * 分类专属字段的输入缓存。key 前面带上分类名，切换分类时互不串值
   * （health 和 relationship 都有「频率」，含义不同）。
   */
  const categoryFields = getCategoryFields(form.category);

  const setCustomValue = (key: string, value: string) =>
    setCustomValues((prev) => ({ ...prev, [`${form.category}:${key}`]: value }));

  const buildInput = (): LifeGoalInput => {
    const raw: Record<string, string> = {};
    for (const spec of categoryFields) {
      raw[spec.key] = customValues[`${form.category}:${spec.key}`] ?? "";
    }
    const { columns, customFields } = buildCategoryValues(categoryFields, raw);
    const payload: LifeGoalInput = { ...form, ...columns };
    if (Object.keys(customFields).length > 0) {
      payload.customFields = customFields;
    } else {
      delete payload.customFields;
    }
    return payload;
  };

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

  /** 目标被删除后清掉选中态，避免下方详情面板指向一个已不存在的目标 */
  const handleGoalDeleted = (goalId: string) => {
    setSelectedCompleted((prev) => (prev === goalId ? null : prev));
  };

  /** 一键把「地点」填成当前所在的具体位置（同时存下经纬度，供地图/水印使用） */
  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const result = await getLocationState();
      if (result.status !== "ready" || !result.location) {
        alert(result.error || "未能获取定位，请检查定位权限");
        return;
      }
      const { latitude, longitude } = result.location;
      const place = await reverseGeocode(latitude, longitude);
      const text = formatPlace(place);
      setForm((prev) => ({
        ...prev,
        location: text || prev.location,
        latitude,
        longitude,
      }));
      if (!text) alert("已记录当前位置坐标，但没能解析出地名，可以手动补一下地点。");
    } finally {
      setLocating(false);
    }
  };

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
          onGoalDeleted={handleGoalDeleted}
        />
        <GoalColumn
          title="已完成"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          goals={completed}
          tone="emerald"
          onSelect={(goal) => setSelectedCompleted((prev) => (prev === goal.id ? null : goal.id))}
          selectedId={selectedCompleted}
          onGoalDeleted={handleGoalDeleted}
        />
        <GoalColumn
          title="未完成"
          icon={<Clock className="h-3.5 w-3.5" />}
          goals={incomplete}
          tone="sky"
          onSelect={(goal) => setSelectedCompleted(null)}
          onGoalDeleted={handleGoalDeleted}
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
              <div className="flex gap-2">
                <Input
                  value={form.location || ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="如：北京 / 冰岛雷克雅未克"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void useCurrentLocation()}
                  disabled={locating}
                  title="用当前位置自动填充地点"
                  className="shrink-0"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  当前位置
                </Button>
              </div>
              {form.latitude != null && form.longitude != null && (
                <p className="mt-1 text-[11px] text-muted">已带上当前位置，地图上会自动打点。</p>
              )}
            </div>
            {/* ── 分类专属字段：由 lib/life-fields.ts 的 CATEGORY_FIELDS 驱动 ── */}
            {categoryFields.map((spec) => {
              const value = customValues[`${form.category}:${spec.key}`] ?? "";
              return (
                <div key={spec.key} className={spec.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    {spec.label}
                    {spec.required && <span className="ml-1 text-danger">*</span>}
                    {spec.unit && <span className="ml-1 font-normal text-muted">（{spec.unit}）</span>}
                  </label>
                  {spec.type === "textarea" ? (
                    <Textarea
                      rows={2}
                      value={value}
                      placeholder={spec.placeholder}
                      onChange={(e) => setCustomValue(spec.key, e.target.value)}
                    />
                  ) : spec.type === "select" ? (
                    <select
                      className="h-10 w-full rounded-[10px] border border-border bg-surface/80 px-3 text-sm"
                      value={value}
                      onChange={(e) => setCustomValue(spec.key, e.target.value)}
                    >
                      <option value="">未选择</option>
                      {spec.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={spec.type === "number" ? "number" : "text"}
                      value={value}
                      placeholder={spec.placeholder}
                      onChange={(e) => setCustomValue(spec.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">描述</label>
              <Textarea rows={3} value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
            </div>
            <p className="text-[11px] text-muted sm:col-span-2">
              带 <span className="text-danger">*</span> 的是建议填写的字段，先空着也能创建。
            </p>
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
