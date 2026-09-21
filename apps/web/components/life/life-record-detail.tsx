"use client";

import { useEffect, useState } from "react";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { Badge, Card } from "@/components/ui";
import { getRecordMediaUrl, type LifeRecord } from "@/lib/life";

export function LifeRecordDetail({ record }: { record: LifeRecord }) {
  const location = [record.country, record.city].filter(Boolean).join(" ");
  // 经纬度不再直接显示：有地名就展示具体位置，坐标只放在 tooltip 里备查
  const coords =
    record.latitude != null && record.longitude != null
      ? `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`
      : "";
  const altitudeText = record.altitude != null ? `海拔 ${Math.round(record.altitude)}m` : "";
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (record.videoUrl) {
      getRecordMediaUrl(record.videoUrl).then(setVideoUrl).catch(() => setVideoUrl(null));
    }
  }, [record.videoUrl]);

  return (
    <Card className="overflow-hidden">
      {record.recordType === "video" && videoUrl ? (
        <video src={videoUrl} controls className="aspect-[16/9] w-full bg-black object-contain" />
      ) : record.watermarkUrl || record.photoUrl ? (
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
        {location ? (
          <p className="text-sm" title={coords ? `坐标：${coords}` : undefined}>
            📍 {location}
            {altitudeText ? ` · ${altitudeText}` : ""}
          </p>
        ) : coords || altitudeText ? (
          <p className="text-[13px] text-muted" title={coords ? `坐标：${coords}` : undefined}>
            📍 位置已记录{altitudeText ? ` · ${altitudeText}` : ""}
          </p>
        ) : null}
        {record.content && <p className="rounded-[10px] bg-surface-muted p-3 text-sm leading-relaxed">{record.content}</p>}
      </div>
    </Card>
  );
}
