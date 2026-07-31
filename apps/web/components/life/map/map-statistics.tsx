"use client";

import { motion } from "framer-motion";
import { Globe2, MapPin, Route, Trophy } from "lucide-react";

import type { MapStatistics } from "@/lib/life-map";
import { CountUp } from "@/components/life/review/count-up";

export function MapStatistics({ stats }: { stats: MapStatistics }) {
  const cards = [
    { icon: <MapPin className="h-4 w-4" />, label: "城市", value: stats.totalCities, color: "#3B82F6" },
    { icon: <Globe2 className="h-4 w-4" />, label: "国家", value: stats.totalCountries, color: "#10B981" },
    { icon: <Route className="h-4 w-4" />, label: "里程 (km)", value: stats.totalDistance, color: "#F59E0B" },
    { icon: <Trophy className="h-4 w-4" />, label: "Bucket 完成", value: stats.bucketCompleted, color: "#EAB308" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-[14px] border border-border bg-surface p-3"
        >
          <div className="flex items-center gap-1.5" style={{ color: c.color }}>
            {c.icon}
            <span className="text-[11px] text-muted">{c.label}</span>
          </div>
          <p className="mt-1 text-xl font-bold">
            <CountUp value={c.value} />
          </p>
        </motion.div>
      ))}
    </div>
  );
}
