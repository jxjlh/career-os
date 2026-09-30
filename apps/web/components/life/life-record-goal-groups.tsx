"use client";

import { ChevronDown, Target } from "lucide-react";
import { useMemo, useState } from "react";

import { LifeRecordCard } from "@/components/life/life-record-card";
import { cn } from "@/components/ui";
import type { LifeRecord } from "@/lib/life";

interface GoalGroup {
  key: string;
  title: string;
  records: LifeRecord[];
  latest: string;
}

function formatRange(records: LifeRecord[]): string {
  const dates = records
    .map((r) => r.createdAt?.slice(0, 10) ?? "")
    .filter(Boolean)
    .sort();
  if (dates.length === 0) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} ~ ${last}`;
}

/**
 * 人生记录 · 按目标分组（默认全部折叠）。
 *
 * 之前所有记录铺成一长条时间轴，照片一多页面就长得没边；
 * 现在先按「所属目标」收成一行（目标名 + 记录条数 + 时间范围），
 * 点开某个目标才展开它下面的全部照片和文案。
 */
export function LifeRecordGoalGroups({ records }: { records: LifeRecord[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo<GoalGroup[]>(() => {
    const map = new Map<string, GoalGroup>();
    for (const record of records) {
      const key = record.goalId || "__none__";
      const group =
        map.get(key) ?? { key, title: record.goalTitle || "未关联目标", records: [], latest: "" };
      group.records.push(record);
      if (!group.title && record.goalTitle) group.title = record.goalTitle;
      map.set(key, group);
    }
    return [...map.values()]
      .map((group) => {
        const sorted = [...group.records].sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        );
        return { ...group, records: sorted, latest: sorted[0]?.createdAt ?? "" };
      })
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [records]);

  const allOpen = groups.length > 0 && groups.every((g) => open[g.key]);

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAll = () => {
    if (allOpen) {
      setOpen({});
      return;
    }
    setOpen(Object.fromEntries(groups.map((g) => [g.key, true])));
  };

  return (
    <div className="space-y-2.5">
      {groups.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="text-[12px] font-medium text-primary transition-colors hover:text-primary-hover"
          >
            {allOpen ? "全部收起" : "全部展开"}
          </button>
        </div>
      )}

      {groups.map((group) => {
        const expanded = Boolean(open[group.key]);
        return (
          <div
            key={group.key}
            className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-text">
                  {group.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-text-tertiary">
                  {group.records.length} 张记录
                  {formatRange(group.records) ? ` · ${formatRange(group.records)}` : ""}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            </button>

            {expanded && (
              <div className="grid gap-3 border-t border-border-subtle p-3 md:grid-cols-2 xl:grid-cols-3">
                {group.records.map((record) => (
                  <LifeRecordCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
