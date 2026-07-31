"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

const pinIcon = L.divIcon({
  className: "bucket-map-pin",
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -28],
});

function FitView({ point }: { point: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(point, 6);
  }, [map, point]);
  return null;
}

interface BucketMapViewProps {
  latitude: number;
  longitude: number;
  label?: string;
}

export function BucketMapView({ latitude, longitude, label }: BucketMapViewProps) {
  const point: [number, number] = [latitude, longitude];
  return (
    <MapContainer
      center={point}
      zoom={6}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "#e5e7eb" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={point} icon={pinIcon}>
        {label && <Popup>{label}</Popup>}
      </Marker>
      <FitView point={point} />
    </MapContainer>
  );
}
