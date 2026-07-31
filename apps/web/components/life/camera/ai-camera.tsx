"use client";

import { Loader2, Camera } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { AspectRatio, AICameraHandle, CameraMode } from "./types";

interface AICameraProps {
  mode: CameraMode;
  aspectRatio: AspectRatio;
  showGrid: boolean;
  facingMode: "user" | "environment";
  countdown: number; // 0 / 3 / 5 / 10
  onCountdownTick?: (remaining: number) => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

const ASPECT_CLASS: Record<AspectRatio, string> = {
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
};

/**
 * 基于 getUserMedia 的相机组件, 支持拍照与录像.
 * 仅客户端运行; 相机不可用时显示提示, 由父组件回退到文件上传.
 */
export const AICamera = forwardRef<AICameraHandle, AICameraProps>(function AICamera(
  { mode, aspectRatio, showGrid, facingMode, countdown, onCountdownTick, onRecordingStateChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [tickCountdown, setTickCountdown] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;
    async function startCamera() {
      setReady(false);
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("当前环境不支持相机, 请使用文件上传。");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: mode === "video",
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        setError("无法访问相机, 请检查浏览器权限或使用文件上传。");
      }
    }
    startCamera();
    return () => {
      mounted = false;
      stopStream();
    };
  }, [facingMode, mode, stopStream]);

  // 录像计时器
  useEffect(() => {
    if (!recording) {
      setRecordSeconds(0);
      return;
    }
    const t = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const runCountdown = useCallback(
    async (seconds: number): Promise<void> => {
      if (seconds <= 0) return;
      for (let i = seconds; i > 0; i--) {
        setTickCountdown(i);
        onCountdownTick?.(i);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setTickCountdown(0);
      onCountdownTick?.(0);
    },
    [onCountdownTick],
  );

  const capture = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return null;
    await runCountdown(countdown);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const [w, h] = computeCaptureSize(video, aspectRatio);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // 居中裁剪到目标比例
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const targetRatio = w / h;
    const videoRatio = vw / vh;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (videoRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }
    // 前置摄像头镜像翻转
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [aspectRatio, countdown, facingMode, runCountdown]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!streamRef.current) return false;
    await runCountdown(countdown);
    chunksRef.current = [];
    const mime = pickSupportedMime();
    try {
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      recordStartRef.current = Date.now();
      setRecording(true);
      onRecordingStateChange?.(true);
      return true;
    } catch {
      return false;
    }
  }, [countdown, onRecordingStateChange, runCountdown]);

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; duration: number } | null> => {
    const rec = recorderRef.current;
    if (!rec) return null;
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        const duration = Math.round((Date.now() - recordStartRef.current) / 1000);
        setRecording(false);
        onRecordingStateChange?.(false);
        resolve({ blob, duration });
      };
      rec.stop();
    });
  }, [onRecordingStateChange]);

  useImperativeHandle(ref, () => ({ capture, startRecording, stopRecording }), [
    capture,
    startRecording,
    stopRecording,
  ]);

  return (
    <div className="relative w-full">
      <div className={`relative overflow-hidden rounded-[16px] bg-black ${ASPECT_CLASS[aspectRatio]}`}>
        <video
          ref={videoRef}
          playsInline
          muted={mode === "photo"}
          className="h-full w-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 网格线 */}
        {showGrid && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/15" />
            ))}
          </div>
        )}

        {/* 倒计时 */}
        {tickCountdown > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-6xl font-bold text-white drop-shadow-lg">{tickCountdown}</span>
          </div>
        )}

        {/* 录像指示 */}
        {recording && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium text-white">{formatDuration(recordSeconds)}</span>
          </div>
        )}

        {/* 状态层 */}
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">正在启动相机…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
            <Camera className="h-6 w-6" />
            <span className="text-xs">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
});

function computeCaptureSize(video: HTMLVideoElement, ratio: AspectRatio): [number, number] {
  const base = Math.min(video.videoWidth || 1080, 1920);
  switch (ratio) {
    case "1:1":
      return [base, base];
    case "4:3":
      return [base, Math.round((base * 3) / 4)];
    case "16:9":
      return [base, Math.round((base * 9) / 16)];
  }
}

function pickSupportedMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
