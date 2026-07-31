"use client";

import { Grid3x3, Ratio, SwitchCamera, Timer } from "lucide-react";

import { Button } from "@/components/ui";
import type { AspectRatio, CameraMode } from "./types";

interface CameraControlsProps {
  mode: CameraMode;
  aspectRatio: AspectRatio;
  showGrid: boolean;
  facingMode: "user" | "environment";
  countdown: number;
  onToggleMode: () => void;
  onCycleAspectRatio: () => void;
  onToggleGrid: () => void;
  onToggleFacing: () => void;
  onCycleCountdown: () => void;
}

const ASPECT_LABEL: Record<AspectRatio, string> = {
  "1:1": "1:1",
  "4:3": "4:3",
  "16:9": "16:9",
};

const COUNTDOWN_OPTIONS = [0, 3, 5, 10];

export function CameraControls({
  mode,
  aspectRatio,
  showGrid,
  facingMode,
  countdown,
  onToggleMode,
  onCycleAspectRatio,
  onToggleGrid,
  onToggleFacing,
  onCycleCountdown,
}: CameraControlsProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface p-2">
      {/* 模式切换: 拍照 / 录像 */}
      <div className="flex rounded-[8px] bg-surface-muted p-0.5">
        <button
          onClick={onToggleMode}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "photo" ? "bg-primary text-white" : "text-muted"
          }`}
        >
          拍照
        </button>
        <button
          onClick={onToggleMode}
          className={`rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "video" ? "bg-primary text-white" : "text-muted"
          }`}
        >
          录像
        </button>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-1">
        <ControlButton active={showGrid} onClick={onToggleGrid} title="网格线">
          <Grid3x3 className="h-4 w-4" />
        </ControlButton>
        <ControlButton onClick={onCycleAspectRatio} title={`比例 ${ASPECT_LABEL[aspectRatio]}`}>
          <Ratio className="h-4 w-4" />
          <span className="text-[10px] font-medium">{ASPECT_LABEL[aspectRatio]}</span>
        </ControlButton>
        <ControlButton
          active={countdown > 0}
          onClick={onCycleCountdown}
          title={countdown > 0 ? `倒计时 ${countdown}s` : "倒计时"}
        >
          <Timer className="h-4 w-4" />
          {countdown > 0 && <span className="text-[10px] font-medium">{countdown}s</span>}
        </ControlButton>
        <ControlButton onClick={onToggleFacing} title={facingMode === "user" ? "前置" : "后置"}>
          <SwitchCamera className="h-4 w-4" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={`flex h-8 flex-col items-center justify-center gap-0 px-2 ${active ? "text-primary" : "text-muted"}`}
    >
      {children}
    </Button>
  );
}

export { COUNTDOWN_OPTIONS, ASPECT_LABEL };
