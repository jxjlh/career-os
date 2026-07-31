"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";
import type { LifeGoal, LifeRecord } from "@/lib/life";

// react-leaflet 依赖 window, 必须关闭 SSR, 否则 Next 构建期预渲染会崩.
const LifeMapView = dynamic(() => import("./life-map-view").then((m) => m.LifeMapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

interface LifeMapClientProps {
  records: LifeRecord[];
  destinations: LifeGoal[];
}

export function LifeMapClient(props: LifeMapClientProps) {
  return <LifeMapView {...props} />;
}

export default LifeMapClient;
