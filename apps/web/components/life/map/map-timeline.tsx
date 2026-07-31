"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import type { MapMarker } from "@/lib/life-map";
import { markerIcon } from "@/lib/life-map";

interface TimelineGroup {
  year: string;
  months: Array<{ month: string; markers: MapMarker[] }>;
}

function groupByTime(markers: MapMarker[]): TimelineGroup[] {
  const groups: Record<string, Record<string, MapMarker[]>> = {};
  for (const m of markers) {
    const ts = m.visitTime || m.createdAt;
    if (!ts) continue;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, "0");
    (groups[year] ??= {})[month] ??= [];
    groups[year][month].push(m);
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({
      year,
      months: Object.entries(months)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, ms]) => ({ month, markers: ms })),
    }));
}

function monthLabel(month: string): string {
  const names = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  return names[Number(month) - 1] ?? month;
}

export function MapTimeline({ markers }: { markers: MapMarker[] }) {
  const groups = groupByTime(markers);
  if (groups.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-border p-6 text-center text-[13px] text-muted">
        还没有时间线足迹, 完成第一个人生目标后这里会亮起来。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.year}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-lg font-bold">{group.year}</h3>
            <span className="text-[11px] text-muted">
              {group.months.reduce((s, m) => s + m.markers.length, 0)} 个足迹
            </span>
          </div>
          {group.months.map((mg) => (
            <div key={mg.month} className="mb-3">
              <p className="mb-1.5 text-[12px] font-medium text-muted">{monthLabel(mg.month)}</p>
              <div className="space-y-2 border-l-2 border-border pl-4">
                {mg.markers.map((m, idx) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  >
                    <Link
                      href={`/life/map/${m.id}`}
                      className="flex items-center gap-2 rounded-[10px] border border-border bg-surface p-2.5 transition-colors hover:border-primary/40"
                    >
                      <span className="text-lg">{markerIcon(m.sourceType)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{m.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          {[m.country, m.city].filter(Boolean).join(" · ") || "未知地点"}
                        </p>
                      </div>
                      {(m.visitTime || m.createdAt) && (
                        <span className="shrink-0 text-[10px] text-muted">
                          {new Date(m.visitTime || m.createdAt || "").getDate()}日
                        </span>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
