"use client";

import { Calendar, Clock, CloudSun, Mountain, Navigation, Tags, Thermometer } from "lucide-react";

import type { WatermarkOptions } from "@/components/life/watermark-canvas";

interface WatermarkSettingsProps {
  options: WatermarkOptions;
  onChange: (options: WatermarkOptions) => void;
}

const ITEMS: Array<{
  key: keyof WatermarkOptions;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "date", label: "日期", icon: <Calendar className="h-3.5 w-3.5" /> },
  { key: "time", label: "时间", icon: <Clock className="h-3.5 w-3.5" /> },
  { key: "city", label: "城市", icon: <Tags className="h-3.5 w-3.5" /> },
  { key: "weather", label: "天气", icon: <CloudSun className="h-3.5 w-3.5" /> },
  { key: "temperature", label: "温度", icon: <Thermometer className="h-3.5 w-3.5" /> },
  { key: "altitude", label: "海拔", icon: <Mountain className="h-3.5 w-3.5" /> },
  { key: "gps", label: "GPS", icon: <Navigation className="h-3.5 w-3.5" /> },
];

/**
 * 水印项开关面板. 用户可单独开关每个水印字段.
 * Logo 与目标标题默认常显 (LifeOS 身份), 其余可关闭.
 */
export function WatermarkSettings({ options, onChange }: WatermarkSettingsProps) {
  const toggle = (key: keyof WatermarkOptions) => {
    onChange({ ...options, [key]: options[key] === false });
  };

  return (
    <div className="rounded-[10px] border border-border bg-surface p-3">
      <p className="mb-2 text-xs font-medium text-muted">水印项 (点击开关)</p>
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map((item) => {
          const active = options[item.key] !== false;
          return (
            <button
              key={item.key}
              onClick={() => toggle(item.key)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
