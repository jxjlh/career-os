"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import type { MapMarker } from "@/lib/life-map";
import { markerColor, markerIcon } from "@/lib/life-map";

// 高德中文瓦片: 无需 API Key, 中文地名展示 (微信地图同源风格)
const TILES = {
  dark: {
    url: "https://webrd0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}",
    attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
  },
  light: {
    url: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}",
    attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
  },
};

function makeIcon(marker: MapMarker) {
  const color = markerColor(marker.status, marker.sourceType);
  const emoji = markerIcon(marker.sourceType);
  return L.divIcon({
    className: "life-map-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:34px;height:34px;">
      <div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);">
        <span style="transform:rotate(45deg);">${emoji}</span>
      </div>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -30],
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 自适应视野: 所有 marker 居中显示
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView([20, 10], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 5);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 6 });
  }, [map, points]);
  return null;
}

// 聚合图层: 通过 leaflet.markercluster 把邻近 marker 合并显示
function ClusterLayer({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (c: { getChildCount: () => number }) =>
        L.divIcon({
          html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#8B5CF6);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;">${c.getChildCount()}</div>`,
          className: "life-map-cluster",
          iconSize: [40, 40],
        }),
    });
    for (const m of markers) {
      if (m.latitude == null || m.longitude == null) continue;
      const marker = L.marker([m.latitude, m.longitude], { icon: makeIcon(m) });
      marker.bindPopup(
        `<div style="min-width:180px;">
          <p style="font-size:13px;font-weight:600;margin:0 0 4px;">${m.title}</p>
          <p style="font-size:11px;color:#888;margin:0 0 2px;">${m.subtitle || ""}</p>
          <p style="font-size:11px;color:#888;margin:0 0 2px;">${formatDate(m.visitTime || m.createdAt)}</p>
          <p style="font-size:11px;color:#888;margin:0;">📸 ${m.photosCount} · 🎥 ${m.videosCount}</p>
        </div>`,
      );
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, markers]);
  return null;
}

interface LifeMapViewProps {
  markers: MapMarker[];
  theme: "dark" | "light";
  showPolyline?: boolean;
  useCluster?: boolean;
}

export function LifeMapView({
  markers,
  theme,
  showPolyline = true,
  useCluster = true,
}: LifeMapViewProps) {
  const tiles = TILES[theme];
  const points = useMemo(
    () =>
      markers
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => [m.latitude as number, m.longitude as number] as [number, number]),
    [markers],
  );

  // Polyline: 按时间升序连接, 展示旅行路线
  const routePoints = useMemo(() => {
    return [...markers]
      .filter((m) => m.latitude != null && m.longitude != null)
      .sort((a, b) => (a.visitTime || a.createdAt || "").localeCompare(b.visitTime || b.createdAt || ""))
      .map((m) => [m.latitude as number, m.longitude as number] as [number, number]);
  }, [markers]);

  const hasRoute = showPolyline && routePoints.length > 1;

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: theme === "dark" ? "#0b1220" : "#e5e7eb" }}
      worldCopyJump
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} />
      <FitBounds points={points} />

      {hasRoute && (
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: theme === "dark" ? "#8B5CF6" : "#6366F1",
            weight: 2,
            opacity: 0.6,
            dashArray: "6 8",
          }}
        />
      )}

      {useCluster ? (
        <ClusterLayer markers={markers} />
      ) : (
        markers
          .filter((m) => m.latitude != null && m.longitude != null)
          .map((m) => (
            <Marker
              key={m.id}
              position={[m.latitude as number, m.longitude as number]}
              icon={makeIcon(m)}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <p className="text-[13px] font-semibold leading-snug">{m.title}</p>
                  {m.subtitle && <p className="text-[11px] text-muted">{m.subtitle}</p>}
                  {(m.visitTime || m.createdAt) && (
                    <p className="text-[11px] text-muted">{formatDate(m.visitTime || m.createdAt)}</p>
                  )}
                  <p className="text-[11px] text-muted">
                    📸 {m.photosCount} · 🎥 {m.videosCount}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))
      )}
    </MapContainer>
  );
}

export default LifeMapView;
