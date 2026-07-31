import { useMemo } from "react";

import { LifeRecordCard } from "@/components/life/life-record-card";
import type { LifeRecord } from "@/lib/life";

export function LifeRecordTimeline({ records }: { records: LifeRecord[] }) {
  const groups = useMemo(() => {
    const map: Record<string, Record<string, LifeRecord[]>> = {};
    for (const record of records) {
      const year = record.createdAt?.slice(0, 4) || "未知";
      const month = record.createdAt?.slice(5, 7) || "00";
      map[year] = map[year] || {};
      map[year][month] = map[year][month] || [];
      map[year][month].push(record);
    }
    return Object.entries(map)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, months]) => ({
        year,
        months: Object.entries(months)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([month, items]) => ({ month, items })),
      }));
  }, [records]);

  return (
    <div className="relative space-y-8 pl-5">
      <div className="absolute bottom-4 left-[7px] top-4 w-px bg-border" />
      {groups.map(({ year, months }) => (
        <div key={year} className="relative">
          <span className="absolute -left-5 top-1 h-4 w-4 rounded-full border-2 border-primary bg-surface" />
          <h2 className="text-base font-bold">{year}年</h2>
          <div className="mt-4 space-y-6">
            {months.map(({ month, items }) => (
              <div key={month} className="relative">
                <span className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full bg-primary/60" />
                <p className="mb-3 text-sm font-medium text-muted">{Number(month)}月</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((record) => (
                    <LifeRecordCard key={record.id} record={record} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
