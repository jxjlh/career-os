"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Sparkles, Trash2, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { LifeCameraPanel } from "@/components/life/camera/life-camera-panel";
import { LifePlanSection } from "@/components/life/ai/life-plan-section";
import { TravelPlanSection } from "@/components/life/ai/travel-plan-section";
import { LifeRecordImage } from "@/components/life/life-record-image";
import { LifeTaskList } from "@/components/life/life-task-list";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { deleteLifeGoal, getCategoryMeta, getGoalRecords, type LifeRecord } from "@/lib/life";
import { describeCustomFields } from "@/lib/life-fields";

type Envelope = { data: any };

export default function LifeGoalDetailPage() {
  const searchParams = useSearchParams();
  const goalId = searchParams.get("id") ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCamera, setShowCamera] = useState(false);

  const goal = useQuery<Envelope>({
    queryKey: ["life-goal", goalId],
    queryFn: () => apiFetch(`/life/goals/${goalId}`),
    enabled: Boolean(goalId),
  });
  const records = useQuery<LifeRecord[]>({
    queryKey: ["life-goal-records", goalId],
    queryFn: () => getGoalRecords(goalId),
    enabled: Boolean(goalId),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/life/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["life-goal", goalId] }),
  });

  // 删除目标：后端会级联删除该目标下的记录，删完回到人生目标页
  const deleteGoal = useMutation({
    mutationFn: () => deleteLifeGoal(goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-goals"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      router.push("/life");
    },
    onError: (e: Error) => alert(e.message || "删除失败，请稍后重试"),
  });

  if (goal.isLoading) return <Skeleton className="h-64" />;
  if (goal.isError) return <p className="text-sm text-muted">目标不存在或已被删除。</p>;
  if (!goal.data) return null;

  const data = goal.data.data;
  const meta = getCategoryMeta(data.category);
  const items = records.data || [];
  // 分类专属字段（出发地 / 出行人数 / 目标岗位 / 目标金额…）按分类配置翻译成徽标
  const customFields = describeCustomFields(data.category, data.customFields);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{data.title}</h1>
            <p className="text-[13px] text-muted">
              {data.location || "未设置地点"} · {data.targetDate || "未设置时间"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>{data.status}</Badge>
              <Badge variant="warning">{data.difficulty}★</Badge>
              <Badge variant="primary">{meta.labelZh}</Badge>
              {data.budget && <Badge variant="warning">预算 {data.budget}</Badge>}
              {data.recommendedDays && <Badge>推荐 {data.recommendedDays} 天</Badge>}
              {data.bestSeason && <Badge variant="success">{data.bestSeason}</Badge>}
              {data.region && <Badge>地区 {data.region}</Badge>}
            </div>
            {customFields.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {customFields.map((field) => (
                  <Badge key={field.key}>
                    {field.label} {field.value}
                    {field.unit ? ` ${field.unit}` : ""}
                  </Badge>
                ))}
              </div>
            )}
            {data.friends && data.friends.length > 0 && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-muted">
                <Users className="h-3.5 w-3.5" />
                同行好友：{data.friends.join("、")}
              </p>
            )}
            {data.description && <p className="mt-3 text-sm text-muted">{data.description}</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {data.status === "pending" && (
            <Button onClick={() => updateStatus.mutate("in_progress")} disabled={updateStatus.isPending}>
              <Sparkles className="h-4 w-4" />
              开始目标
            </Button>
          )}
          {data.status === "in_progress" && (
            <Button onClick={() => updateStatus.mutate("completed")} disabled={updateStatus.isPending}>
              <Check className="h-4 w-4" />
              完成目标
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowCamera((v) => !v)}>
            <Camera className="h-4 w-4" />
            记录这一刻
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm(`确定要删除「${data.title}」吗？\n该目标下的记录也会一并删除。`)) {
                deleteGoal.mutate();
              }
            }}
            disabled={deleteGoal.isPending}
            className="text-muted hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
            {deleteGoal.isPending ? "删除中…" : "删除目标"}
          </Button>
        </div>
      </Card>

      {showCamera && (
        <LifeCameraPanel
          goalId={goalId}
          onRecorded={() => queryClient.invalidateQueries({ queryKey: ["life-goal-records", goalId] })}
        />
      )}

      {/* 世界探索类目标：用 AI 旅行攻略替代成长任务；其余分类保留成长任务，
          并在下方按需插入「按分类生成的 AI 规划」（没生成过时只有一行入口）。 */}
      {data.category === "travel" ? (
        <TravelPlanSection goalId={goalId} />
      ) : (
        <>
          <LifeTaskList goalId={goalId} />
          <LifePlanSection goalId={goalId} category={data.category} />
        </>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">人生记录</h2>
        {items.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border bg-surface p-6 text-center text-[13px] text-muted">
            还没有记录，点击&ldquo;记录这一刻&rdquo;开始。
          </p>
        )}
        {items.map((record: any) => (
          <Card key={record.id} className="p-4">
            {record.watermarkUrl && <LifeRecordImage path={record.watermarkUrl} />}
            {record.content && <p className="text-sm">{record.content}</p>}
            <p className="mt-2 text-xs text-muted">
              {record.createdAt?.slice(0, 10) || ""}
              {/* 位置优先显示具体地名（country + city 里存的就是「北京市朝阳区」这类结果），
                  不再直接把经纬度打给用户看 */}
              {record.country || record.city ? (
                ` · ${[record.country, record.city].filter(Boolean).join(" ")}`
              ) : record.latitude != null ? (
                " · 位置已记录"
              ) : (
                ""
              )}
              {record.altitude != null ? ` · 海拔 ${Math.round(record.altitude)}m` : ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
