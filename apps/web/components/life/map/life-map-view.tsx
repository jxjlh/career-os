"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { LifeGoal, LifeRecord } from "@/lib/life";

// 蓝色小圆点: 标记人生瞬间(带坐标的记录). 使用 divIcon 避免默认图标的资源路径问题.
const recordIcon = L.divIcon({
  className: "life-map-record-marker",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:2px solid #ffffff;box-shadow:0 0 0 3px rgba(59,130,246,0.25),0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -9],
});

// 琥珀色图钉: 标记人生目标目的地(带坐标的目标).
const destinationIcon = L.divIcon({
  className: "life-map-destination-marker",
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -28],
});

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 根据全部标记自适应视野. 空数据时回到世界视图.
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

interface LifeMapViewProps {
  records: LifeRecord[];
  destinations: LifeGoal[];
}

export function LifeMapView({ records, destinations }: LifeMapViewProps) {
  const points: Array<[number, number]> = [
    ...records
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => [r.latitude as number, r.longitude as number] as [number, number]),
    ...destinations
      .filter((g) => g.latitude != null && g.longitude != null)
      .map((g) => [g.latitude as number, g.longitude as number] as [number, number]),
  ];

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#0b1220" }}
      worldCopyJump
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />

      {records
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((record) => (
          <Marker
            key={`record-${record.id}`}
            position={[record.latitude as number, record.longitude as number]}
            icon={recordIcon}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1">
                {record.photoUrl ? (
                  <p className="text-[11px] text-muted">📸 人生瞬间</p>
                ) : (
                  <p className="text-[11px] text-muted">✨ 人生瞬间</p>
                )}
                <p className="text-[13px] font-medium leading-snug text-foreground">
                  {record.content || "无内容"}
                </p>
                {(record.city || record.country) && (
                  <p className="text-[11px] text-muted">
                    {[record.country, record.city].filter(Boolean).join(" · ")}
                  </p>
                )}
                {record.createdAt && (
                  <p className="text-[11px] text-muted">{formatDate(record.createdAt)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      {destinations
        .filter((g) => g.latitude != null && g.longitude != null)
        .map((goal) => (
          <Marker
            key={`goal-${goal.id}`}
            position={[goal.latitude as number, goal.longitude as number]}
            icon={destinationIcon}
          >
            <Popup>
              <div className="min-w-[180px] space-y-1">
                <p className="text-[11px] text-muted">🎯 目的地</p>
                <p className="text-[13px] font-medium leading-snug text-foreground">{goal.title}</p>
                {goal.location && <p className="text-[11px] text-muted">{goal.location}</p>}
                {goal.targetDate && (
                  <p className="text-[11px] text-muted">目标日期 {formatDate(goal.targetDate)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}

export default LifeMapView;
