"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { getLifeMap } from "@/lib/life-map";
import { LifeMapClient } from "@/components/life/map/life-map-client";

/**
 * YOUR LIFE MAP —— 首页地图预览（380px 高）。
 * Marker 不只是地理标记，对应目标/记忆/事件。
 * 点击 marker 显示弹窗（Tokyo / FIRST SOLO TRIP / 2026.04）由 LifeMapClient 内部处理。
 */
export function LifeMapPreview() {
  const { t } = useI18n();
  const map = useQuery({ queryKey: ["life-map"], queryFn: () => getLifeMap() });

  const markers = map.data?.markers ?? [];

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
            {t("dashboard.yourLifeMap")}
          </h2>
          <p className="mt-1 text-[13px] italic text-text-tertiary">{t("dashboard.lifeMapSub")}</p>
        </div>
        <Link
          href="/life/map"
          className="flex items-center gap-1 text-[12px] text-text-secondary transition-colors hover:text-primary-glow"
        >
          <span>{t("dashboard.viewFullMap")}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative mt-3 h-[380px] overflow-hidden rounded-[16px] border border-border-subtle bg-surface/40">
        <LifeMapClient markers={markers} showPolyline={false} useCluster={false} />
        {markers.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
            <p className="text-[13px] text-text-tertiary">{t("common.empty")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
