"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import Link from "next/link";

import { LifeRecordImage } from "@/components/life/life-record-image";
import { CATEGORY_META, type LifeRecord } from "@/lib/life";

export function LifeRecordCard({ record }: { record: LifeRecord }) {
  const meta = CATEGORY_META.other;
  const date = record.createdAt?.slice(0, 10) || "";
  const location = [record.country, record.city].filter(Boolean).join(" ");
  const mediaPath = record.watermarkUrl || record.photoUrl;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -2 }}
      className="overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <Link href={`/life/records/${record.id}`} className="block">
        {record.recordType === "video" && (record.thumbnailUrl || record.videoUrl) ? (
          <div className="relative">
            <LifeRecordImage path={record.thumbnailUrl || mediaPath || ""} />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
                <Play className="h-5 w-5 fill-white" />
              </span>
            </span>
          </div>
        ) : mediaPath ? (
          <LifeRecordImage path={mediaPath} />
        ) : (
          <div className="flex h-36 items-center justify-center bg-surface-muted text-4xl">{meta.icon}</div>
        )}
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{record.goalTitle || "人生记录"}</p>
            <span className="shrink-0 text-xs text-muted">{date}</span>
          </div>
          {location && <p className="mt-1 text-[13px] text-muted">{location}</p>}
          {record.content && <p className="mt-2 line-clamp-2 text-[13px] text-text/80">{record.content}</p>}
        </div>
      </Link>
    </motion.div>
  );
}
