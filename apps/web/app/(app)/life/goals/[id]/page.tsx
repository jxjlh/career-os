"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { CameraCapture } from "@/components/life/camera-capture";
import { LifeRecordImage } from "@/components/life/life-record-image";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { CATEGORY_META, getGoalRecords, type LifeRecord } from "@/lib/life";

type Envelope = { data: any };

export default function LifeGoalDetailPage() {
  const params = useParams<{ id: string }>();
  const goalId = params.id;
  const queryClient = useQueryClient();
  const [showCamera, setShowCamera] = useState(false);

  const goal = useQuery<Envelope>({
    queryKey: ["life-goal", goalId],
    queryFn: () => apiFetch(`/life/goals/${goalId}`),
  });
  const records = useQuery<LifeRecord[]>({
    queryKey: ["life-goal-records", goalId],
    queryFn: () => getGoalRecords(goalId),
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
  const meta = CATEGORY_META[data.category] || CATEGORY_META.other;
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
            </div>
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
            <Link href={`/life/goals/${goalId}/ai`}>
              <Button variant="outline">
                <Sparkles className="h-4 w-4" />
                AI 生成旅行攻略
              </Button>
            </Link>
          )}
          <Link href={`/life/goals/${goalId}/growth`}>
            <Button variant="outline">
              <Sparkles className="h-4 w-4" />
              {data.category === "travel" ? "AI 成长规划" : "🤖 AI 成长规划"}
            </Button>
          </Link>
        </div>
      </Card>

      {showCamera && (
        <CameraCapture
          goalId={goalId}
          goalTitle={data.title}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["life-goal-records", goalId] })}
        />
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">人生记录</h2>
        {items.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border bg-surface p-6 text-center text-[13px] text-muted">
            还没有记录，点击“记录这一刻”开始。
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
