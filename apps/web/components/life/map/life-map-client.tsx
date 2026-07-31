"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui";

import type { MapMarker } from "@/lib/life-map";

// react-leaflet 依赖 window, 关闭 SSR 避免构建期预渲染崩溃.
const LifeMapView = dynamic(() => import("./life-map-view").then((m) => m.LifeMapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

interface LifeMapClientProps {
  markers: MapMarker[];
  showPolyline?: boolean;
  useCluster?: boolean;
}

export function LifeMapClient(props: LifeMapClientProps) {
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme === "dark" ? "dark" : "light") as "dark" | "light";
  return <LifeMapView theme={theme} markers={props.markers} showPolyline={props.showPolyline} useCluster={props.useCluster} />;
}

export default LifeMapClient;
