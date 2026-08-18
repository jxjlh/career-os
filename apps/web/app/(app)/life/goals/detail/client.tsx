"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { LifeCameraPanel } from "@/components/life/camera/life-camera-panel";
import { LifeRecordImage } from "@/components/life/life-record-image";
import { LifeTaskList } from "@/components/life/life-task-list";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getCategoryMeta, getGoalRecords, type LifeRecord } from "@/lib/life";

type Envelope = { data: any };

export default function LifeGoalDetailPage() {
  const searchParams = useSearchParams();
  const goalId = searchParams.get("id") ?? "";
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

  if (goal.isLoading) return <Skeleton className="h-64" />;
  if (goal.isError) return <p className="text-sm text-muted">目标不存在或已被删除。</p>;
  if (!goal.data) return null;

  const data = goal.data.data;
  const meta = getCategoryMeta(data.category);
  const items = records.data || [];

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
          {data.category === "travel" && (
            <Link href={`/life/goals/ai?goalId=${goalId}`}>
              <Button variant="outline">
                <Sparkles className="h-4 w-4" />
                AI 生成旅行攻略
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {showCamera && (
        <LifeCameraPanel
          goalId={goalId}
          onRecorded={() => queryClient.invalidateQueries({ queryKey: ["life-goal-records", goalId] })}
        />
      )}

      <LifeTaskList goalId={goalId} />

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">人生记录</h2>
        {items.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border bg-surface p-6 text-center text-[13px] text-muted">
            还没有记录，点击"记录这一刻"开始。
          </p>
        )}
        {items.map((record: any) => (
          <Card key={record.id} className="p-4">
            {record.watermarkUrl && <LifeRecordImage path={record.watermarkUrl} />}
            {record.content && <p className="text-sm">{record.content}</p>}
            <p className="mt-2 text-xs text-muted">
              {record.createdAt?.slice(0, 10) || ""}
              {record.city ? ` · ${record.city}` : ""}
              {record.latitude ? ` · ${record.latitude.toFixed(4)}, ${record.longitude?.toFixed(4)}` : ""}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
