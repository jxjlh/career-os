"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

// react-leaflet 依赖 window, 关闭 SSR 避免构建期预渲染崩溃.
const BucketMapView = dynamic(() => import("./bucket-map-view").then((m) => m.BucketMapView), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

interface BucketMapClientProps {
  latitude: number;
  longitude: number;
  label?: string;
}

export function BucketMapClient(props: BucketMapClientProps) {
  return <BucketMapView {...props} />;
}

export default BucketMapClient;
