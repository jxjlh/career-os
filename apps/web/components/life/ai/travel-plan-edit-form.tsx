"use client";

import { useState } from "react";

import { Button, Card, Input, Textarea } from "@/components/ui";
import type { TravelDay, TravelPlanResponse, TravelPlanUpdateRequest } from "@/lib/life";

function StringListEditor({
  label,
  items,
  onChange,
  addLabel,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const update = (i: number, val: string) => onChange(items.map((it, idx) => (idx === i ? val : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">{label}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={it} onChange={(e) => update(i, e.target.value)} />
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
            >
              移除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="text-xs text-primary"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

export function TravelPlanEditForm({
  plan,
  onSave,
  onCancel,
  saving,
}: {
  plan: TravelPlanResponse;
  onSave: (payload: TravelPlanUpdateRequest) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(plan.title ?? "");
  const [summary, setSummary] = useState(plan.summary ?? "");
  const [bestTime, setBestTime] = useState(plan.bestTime ?? "");
  const [route, setRoute] = useState<TravelDay[]>(
    plan.route.map((d) => ({ ...d, activities: [...d.activities] })),
  );
  const [preparation, setPreparation] = useState<string[]>([...(plan.preparation ?? [])]);
  const [tips, setTips] = useState<string[]>([...(plan.tips ?? [])]);

  const updateDayTitle = (i: number, val: string) =>
    setRoute(route.map((d, idx) => (idx === i ? { ...d, title: val } : d)));
  const updateActivity = (dayIdx: number, actIdx: number, val: string) =>
    setRoute(
      route.map((d, di) =>
        di === dayIdx
          ? { ...d, activities: d.activities.map((a, ai) => (ai === actIdx ? val : a)) }
          : d,
      ),
    );
  const addActivity = (dayIdx: number) =>
    setRoute(
      route.map((d, di) => (di === dayIdx ? { ...d, activities: [...d.activities, ""] } : d)),
    );
  const removeActivity = (dayIdx: number, actIdx: number) =>
    setRoute(
      route.map((d, di) =>
        di === dayIdx ? { ...d, activities: d.activities.filter((_, ai) => ai !== actIdx) } : d,
      ),
    );
  const removeDay = (dayIdx: number) => setRoute(route.filter((_, i) => i !== dayIdx));
  const addDay = () =>
    setRoute([...route, { day: route.length + 1, title: "", activities: [""] }]);

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="mb-1 text-xs font-medium text-muted">标题</p>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted">简介</p>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted">最佳时间</p>
        <Input value={bestTime} onChange={(e) => setBestTime(e.target.value)} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">每日路线</p>
        {route.map((day, di) => (
          <div key={di} className="rounded-[10px] border border-border bg-surface/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">第 {day.day} 天</span>
              <button
                type="button"
                onClick={() => removeDay(di)}
                className="text-xs text-muted transition-colors hover:text-danger"
              >
                删除这天
              </button>
            </div>
            <Input
              value={day.title}
              onChange={(e) => updateDayTitle(di, e.target.value)}
              placeholder="当天主题"
            />
            <div className="mt-2 space-y-2">
              {day.activities.map((act, ai) => (
                <div key={ai} className="flex items-center gap-2">
                  <Input
                    value={act}
                    onChange={(e) => updateActivity(di, ai, e.target.value)}
                    placeholder="活动"
                  />
                  <button
                    type="button"
                    onClick={() => removeActivity(di, ai)}
                    className="shrink-0 text-xs text-muted transition-colors hover:text-danger"
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addActivity(di)}
                className="text-xs text-primary"
              >
                + 添加活动
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addDay} className="text-xs text-primary">
          + 添加一天
        </button>
      </div>

      <StringListEditor
        label="行前准备"
        items={preparation}
        onChange={setPreparation}
        addLabel="+ 添加准备项"
      />
      <StringListEditor
        label="注意事项"
        items={tips}
        onChange={setTips}
        addLabel="+ 添加注意事项"
      />

      <div className="flex gap-2 pt-2">
        <Button
          variant="primary"
          disabled={saving}
          onClick={() =>
            onSave({
              title,
              summary,
              bestTime,
              route: route.map((d, i) => ({ ...d, day: i + 1 })),
              preparation,
              tips,
            })
          }
        >
          {saving ? "保存中..." : "保存修改"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          取消
        </Button>
      </div>
    </Card>
  );
}
