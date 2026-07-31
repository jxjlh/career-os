"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Aperture,
  ArrowLeft,
  Camera as CameraIcon,
  Check,
  Image as ImageIcon,
  Loader2,
  MapPin,
  RefreshCw,
  Square,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AICamera } from "@/components/life/camera/ai-camera";
import { CameraControls } from "@/components/life/camera/camera-controls";
import { SceneResultCard } from "@/components/life/camera/scene-result-card";
import type { AICameraHandle } from "@/components/life/camera/types";
import { RecordingPulse, ShutterAnimation } from "@/components/life/camera/shutter-animation";
import { UploadProgress, type UploadState } from "@/components/life/camera/upload-progress";
import { WatermarkSettings } from "@/components/life/camera/watermark-settings";
import { createWatermarkImage, DEFAULT_WATERMARK_OPTIONS, type WatermarkOptions } from "@/components/life/watermark-canvas";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import {
  analyzePhoto,
  createLifeRecord,
  getLifeGoals,
  type PhotoAnalysisResponse,
} from "@/lib/life";
import { getCurrentLocation, getCurrentWeather, formatGps, reverseGeocode } from "@/lib/location";

const COUNTDOWN_OPTIONS = [0, 3, 5, 10];
const ASPECT_OPTIONS = ["1:1", "4:3", "16:9"] as const;

export default function CameraPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cameraRef = useRef<AICameraHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:3" | "16:9">("4:3");
  const [showGrid, setShowGrid] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [countdownIdx, setCountdownIdx] = useState(0);
  const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>(DEFAULT_WATERMARK_OPTIONS);

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [recording, setRecording] = useState(false);
  const [flash, setFlash] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sceneResult, setSceneResult] = useState<PhotoAnalysisResponse | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState<{ latitude: number; longitude: number; altitude?: number | null } | null>(null);
  const [place, setPlace] = useState<{ city?: string; country?: string } | null>(null);
  const [weather, setWeather] = useState<{ weather: string; temperature: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("正在获取定位…");

  const [selectedGoalId, setSelectedGoalId] = useState<string>("");

  const goalsQuery = useQuery({ queryKey: ["life-goals"], queryFn: getLifeGoals });

  // 获取定位 + 反向地理编码 + 天气 (拍照前预加载, 失败不阻塞)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const loc = await getCurrentLocation();
      if (!mounted) return;
      if (loc) {
        setLocation(loc);
        setLocationStatus(`已定位 ${formatGps(loc.latitude, loc.longitude)}`);
        const [p, w] = await Promise.all([
          reverseGeocode(loc.latitude, loc.longitude),
          getCurrentWeather(loc.latitude, loc.longitude),
        ]);
        if (!mounted) return;
        if (p) setPlace(p);
        if (w) setWeather(w);
      } else {
        setLocationStatus("未获取定位");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const countdown = COUNTDOWN_OPTIONS[countdownIdx];

  const handleShutter = async () => {
    setError(null);
    if (mode === "photo") {
      setFlash(true);
      setTimeout(() => setFlash(false), 350);
      const blob = await cameraRef.current?.capture();
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
        await runSceneAnalysis(blob);
      }
    } else {
      // 录像模式
      if (!recording) {
        const ok = await cameraRef.current?.startRecording();
        if (!ok) setError("无法开始录像, 请检查相机权限。");
      } else {
        const result = await cameraRef.current?.stopRecording();
        if (result) {
          router.push(`/life/video?blob_url=${encodeURIComponent(URL.createObjectURL(result.blob))}&duration=${result.duration}`);
        }
      }
    }
  };

  const runSceneAnalysis = async (_blob: Blob) => {
    setSceneLoading(true);
    setSceneResult(null);
    try {
      const result = await analyzePhoto({
        latitude: location?.latitude,
        longitude: location?.longitude,
        city: place?.city,
        country: place?.country,
        weather: weather?.weather,
        temperature: weather?.temperature ?? null,
        altitude: location?.altitude ?? null,
        capturedAt: new Date().toISOString(),
        goalId: selectedGoalId || undefined,
      });
      setSceneResult(result);
    } catch {
      // 场景识别失败不阻塞上传
    } finally {
      setSceneLoading(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!capturedBlob) throw new Error("没有可上传的照片");
      const goalId = selectedGoalId || goalsQuery.data?.[0]?.id;
      if (!goalId) throw new Error("请先创建一个人生目标");

      setUploadState("uploading");
      setUploadProgress(10);

      const file = new File([capturedBlob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      const date = new Date();
      const watermarked = await createWatermarkImage(
        file,
        {
          date: date.toISOString().slice(0, 10).replaceAll("-", "."),
          time: date.toTimeString().slice(0, 5),
          goalTitle: goalsQuery.data?.find((g) => g.id === goalId)?.title ?? "人生记录",
          city: place?.city,
          country: place?.country,
          gps: formatGps(location?.latitude, location?.longitude) || undefined,
          weather: weather?.weather,
          temperature: weather?.temperature ?? null,
          altitude: location?.altitude ?? null,
        },
        watermarkOptions,
      );

      setUploadProgress(50);
      await createLifeRecord(goalId, {
        file: watermarked,
        content: content || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        city: place?.city,
        country: place?.country,
        weather: weather?.weather,
        altitude: location?.altitude ?? null,
      });
      setUploadProgress(100);
      setUploadState("success");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
      setTimeout(() => {
        setUploadState("idle");
        setCapturedBlob(null);
        setCapturedUrl(null);
        setContent("");
        setSceneResult(null);
      }, 1500);
    },
    onError: (e: Error) => {
      setUploadState("error");
      setError(e.message || "上传失败, 请重试");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
    const url = URL.createObjectURL(file);
    setCapturedBlob(file);
    setCapturedUrl(url);
    await runSceneAnalysis(file);
  };

  if (goalsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="aspect-[4/3] rounded-[16px]" />
      </div>
    );
  }

  const goals = goalsQuery.data ?? [];
  const activeGoal = goals.find((g) => g.id === selectedGoalId) ?? goals[0];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ShutterAnimation flash={flash} />

      <div className="flex items-center gap-2">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <CameraIcon className="h-5 w-5" />
          AI 相机
        </h1>
      </div>

      {/* 目标选择 */}
      {goals.length === 0 ? (
        <EmptyState
          title="先创建一个人生目标"
          description="AI 相机记录需要关联一个人生目标, 才能纳入成长体系。"
          action={
            <Link href="/life">
              <Button>去创建目标</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto rounded-[10px] border border-border bg-surface p-2">
          <span className="shrink-0 text-xs text-muted">关联目标:</span>
          {goals.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGoalId(g.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                (selectedGoalId || goals[0].id) === g.id
                  ? "bg-primary text-white"
                  : "bg-surface-muted text-muted"
              }`}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      {/* 定位状态 */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5" />
        <span>{locationStatus}</span>
        {place?.city && <span>· {place.country} {place.city}</span>}
        {weather && <span>· {weather.weather} {weather.temperature}°C</span>}
      </div>

      {goals.length > 0 && (
        <>
          <AICamera
            ref={cameraRef}
            mode={mode}
            aspectRatio={aspectRatio}
            showGrid={showGrid}
            facingMode={facingMode}
            countdown={countdown}
            onRecordingStateChange={setRecording}
          />

          <CameraControls
            mode={mode}
            aspectRatio={aspectRatio}
            showGrid={showGrid}
            facingMode={facingMode}
            countdown={countdown}
            onToggleMode={() => setMode((m) => (m === "photo" ? "video" : "photo"))}
            onCycleAspectRatio={() =>
              setAspectRatio((a) => {
                const idx = ASPECT_OPTIONS.indexOf(a);
                return ASPECT_OPTIONS[(idx + 1) % ASPECT_OPTIONS.length];
              })
            }
            onToggleGrid={() => setShowGrid((s) => !s)}
            onToggleFacing={() => setFacingMode((f) => (f === "user" ? "environment" : "user"))}
            onCycleCountdown={() => setCountdownIdx((i) => (i + 1) % COUNTDOWN_OPTIONS.length)}
          />

          {/* 快门按钮 */}
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="从相册选择">
              <ImageIcon className="h-5 w-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleShutter}
              disabled={uploadState === "uploading"}
              className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-text/80 bg-transparent"
            >
              {mode === "photo" ? (
                <Aperture className="h-8 w-8 text-text" />
              ) : recording ? (
                <Square className="h-6 w-6 rounded-[4px] bg-red-500 text-white" />
              ) : (
                <span className="h-10 w-10 rounded-full bg-red-500" />
              )}
              <RecordingPulse active={recording} />
            </motion.button>

            <div className="w-9" />
          </div>

          {/* 预览 + 场景识别 */}
          {capturedUrl && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <img
                src={capturedUrl}
                alt="拍摄预览"
                className="w-full rounded-[12px] border border-border"
              />
              <SceneResultCard result={sceneResult} loading={sceneLoading} />

              <textarea
                rows={2}
                placeholder="写点什么吧 (可选)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />

              <UploadProgress state={uploadState} progress={uploadProgress} />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setCapturedBlob(null);
                    setCapturedUrl(null);
                    setSceneResult(null);
                    setContent("");
                    setUploadState("idle");
                  }}
                  disabled={uploadState === "uploading"}
                >
                  <RefreshCw className="h-4 w-4" />
                  重拍
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadState === "uploading" || uploadState === "success"}
                >
                  {uploadState === "uploading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : uploadState === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadState === "uploading"
                    ? "上传中…"
                    : uploadState === "success"
                      ? "记录完成"
                      : "生成水印并上传"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 水印设置 (始终展示, 拍照前可调) */}
          {!capturedUrl && (
            <WatermarkSettings options={watermarkOptions} onChange={setWatermarkOptions} />
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <p className="text-center text-xs text-muted">
            {mode === "photo" ? "点击快门拍照, 自动添加水印并上传" : "点击开始录像, 再次点击停止"}
            {activeGoal && ` · 关联「${activeGoal.title}」`}
          </p>
        </>
      )}
    </div>
  );
}
