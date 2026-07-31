"use client";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { Badge, Card } from "@/components/ui";
import type { LifeRecord } from "@/lib/life";

export function LifeRecordDetail({ record }: { record: LifeRecord }) {
  const location = [record.country, record.city].filter(Boolean).join(" ");
  return (
    <Card className="overflow-hidden">
      {record.watermarkUrl || record.photoUrl ? (
        <LifeRecordImage path={record.watermarkUrl || record.photoUrl!} />
      ) : (
        <div className="flex h-40 items-center justify-center bg-surface-muted text-4xl">📷</div>
      )}
      <div className="space-y-3 p-5">
        <h1 className="text-lg font-semibold">{record.goalTitle || "人生记录"}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{record.recordType}</Badge>
          {record.weather && <Badge variant="ai">{record.weather}</Badge>}
        </div>
        <p className="text-sm text-muted">{record.createdAt?.replace("T", " ").slice(0, 16)}</p>
        {location && <p className="text-sm">📍 {location}</p>}
        {record.latitude != null && record.longitude != null && (
          <p className="text-[13px] text-muted">
            GPS：{record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
            {record.altitude != null ? ` · 海拔 ${record.altitude}m` : ""}
          </p>
        )}
        {record.content && <p className="rounded-[10px] bg-surface-muted p-3 text-sm leading-relaxed">{record.content}</p>}
      </div>
    </Card>
  );
}
