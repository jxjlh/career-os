"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Film,
  Loader2,
  Upload,
  Video as VideoIcon,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { JournalResultCard } from "@/components/life/camera/journal-result-card";
import { UploadProgress, type UploadState } from "@/components/life/camera/upload-progress";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import {
  createVideoRecord,
  generateJournal,
  getLifeGoals,
  type JournalResponse,
} from "@/lib/life";
import { getCurrentLocation, getCurrentWeather, formatGps, reverseGeocode } from "@/lib/location";

const DURATION_PRESETS = [
  { label: "30 秒", value: 30 },
  { label: "60 秒", value: 60 },
  { label: "3 分钟", value: 180 },
];

function VideoLogContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blobUrl = searchParams.get("blob_url");
  const presetDuration = searchParams.get("duration");

  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(blobUrl);
  const [duration, setDuration] = useState<number>(presetDuration ? Number(presetDuration) : 30);
  const [content, setContent] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [journalResult, setJournalResult] = useState<JournalResponse | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState<{ latitude: number; longitude: number; altitude?: number | null } | null>(null);
  const [place, setPlace] = useState<{ city?: string; country?: string } | null>(null);
  const [weather, setWeather] = useState<{ weather: string; temperature: number } | null>(null);

  const goalsQuery = useQuery({ queryKey: ["life-goals"], queryFn: getLifeGoals });

  // 从相机页跳转来的视频 blob
  useEffect(() => {
    if (!blobUrl) return;
    fetch(blobUrl)
      .then((r) => r.blob())
      .then((b) => setVideoBlob(b))
      .catch(() => setError("无法加载视频, 请重新录制。"));
  }, [blobUrl]);

  // 定位 + 天气预加载
  useEffect(() => {
    let mounted = true;
    (async () => {
      const loc = await getCurrentLocation();
      if (!mounted || !loc) return;
      setLocation(loc);
      const [p, w] = await Promise.all([
        reverseGeocode(loc.latitude, loc.longitude),
        getCurrentWeather(loc.latitude, loc.longitude),
      ]);
      if (!mounted) return;
      if (p) setPlace(p);
      if (w) setWeather(w);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setVideoBlob(file);
    setVideoUrl(URL.createObjectURL(file));
  };

  const runJournal = async () => {
    setJournalLoading(true);
    setJournalResult(null);
    try {
      const result = await generateJournal({
        mediaType: "video",
        mediaDescription: content || "一段视频日志",
        city: place?.city,
        country: place?.country,
        weather: weather?.weather,
        temperature: weather?.temperature ?? null,
        altitude: location?.altitude ?? null,
        capturedAt: new Date().toISOString(),
        goalId: selectedGoalId || undefined,
        goalTitle: goalsQuery.data?.find((g) => g.id === selectedGoalId)?.title,
      });
      setJournalResult(result);
    } catch {
      // 失败不阻塞
    } finally {
      setJournalLoading(false);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!videoBlob) throw new Error("请先选择视频");
      const goalId = selectedGoalId || goalsQuery.data?.[0]?.id;
      if (!goalId) throw new Error("请先创建一个人生目标");

      setUploadState("uploading");
      setUploadProgress(10);

      const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, {
        type: videoBlob.type || "video/webm",
      });

      // 生成封面: 取视频第一帧
      const thumbnail = await generateThumbnail(videoUrl);

      setUploadProgress(40);
      await createVideoRecord(goalId, {
        video: videoFile,
        thumbnail,
        content: content || journalResult?.body || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        city: place?.city,
        country: place?.country,
        weather: weather?.weather,
        altitude: location?.altitude ?? null,
        durationSeconds: duration,
        sceneType: "travel",
        aiTags: journalResult?.keywords,
      });
      setUploadProgress(100);
      setUploadState("success");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["life-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["life-map"] });
      queryClient.invalidateQueries({ queryKey: ["life-records"] });
      setTimeout(() => router.push("/life/records"), 1500);
    },
    onError: (e: Error) => {
      setUploadState("error");
      setError(e.message || "上传失败, 请重试");
    },
  });

  if (goalsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    );
  }

  const goals = goalsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/life">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <VideoIcon className="h-5 w-5" />
          视频日志
        </h1>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          title="先创建一个人生目标"
          description="视频日志需要关联一个人生目标, 才能纳入成长体系。"
          action={
            <Link href="/life">
              <Button>去创建目标</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* 视频预览 / 选择 */}
          {videoUrl ? (
            <motion.video
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={videoUrl}
              controls
              className="w-full rounded-[12px] border border-border bg-black"
            />
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-border bg-surface-muted text-muted"
            >
              <Film className="h-8 w-8" />
              <span className="text-sm">选择一段视频文件</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* 时长预设 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">时长:</span>
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDuration(p.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  duration === p.value
                    ? "bg-primary text-white"
                    : "bg-surface-muted text-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 目标选择 */}
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

          {/* 视频描述 */}
          <textarea
            rows={2}
            placeholder="描述这段视频 (可选, 用于 AI 生成日志)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />

          {/* AI 日志生成 */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={runJournal}
              disabled={!videoBlob || journalLoading}
            >
              {journalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {journalLoading ? "AI 生成中…" : "AI 生成日志"}
            </Button>
            <JournalResultCard result={journalResult} loading={journalLoading} />
          </div>

          {/* 上传 */}
          <UploadProgress
            state={uploadState}
            progress={uploadProgress}
            message={uploadState === "uploading" ? "正在上传视频…" : undefined}
          />

          <Button
            className="w-full"
            onClick={() => uploadMutation.mutate()}
            disabled={!videoBlob || uploadState === "uploading" || uploadState === "success"}
          >
            {uploadState === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploadState === "success" ? "上传完成" : "上传视频日志"}
          </Button>

          {error && <p className="text-xs text-danger">{error}</p>}

          <p className="text-center text-xs text-muted">
            视频自动压缩上传, 关联「{goals.find((g) => g.id === (selectedGoalId || goals[0]?.id))?.title ?? "人生目标"}」
          </p>
        </>
      )}
    </div>
  );
}

/** 从视频第一帧生成封面缩略图 (canvas capture). */
async function generateThumbnail(videoUrl: string | null): Promise<File | null> {
  if (!videoUrl) return null;
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.muted = true;
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
          else resolve(null);
        }, "image/jpeg", 0.85);
      } catch {
        resolve(null);
      }
    };
    video.onerror = () => resolve(null);
  });
}

export default function VideoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      }
    >
      <VideoLogContent />
    </Suspense>
  );
}
