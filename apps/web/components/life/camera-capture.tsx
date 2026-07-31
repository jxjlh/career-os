"use client";

import { Camera, Loader2, MapPin, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, Card, Textarea } from "@/components/ui";
import { getCurrentLocation } from "@/lib/location";
import { createLifeRecord } from "@/lib/life";
import { createWatermarkImage } from "@/components/life/watermark-canvas";

export function CameraCapture({
  goalId,
  goalTitle,
  onSuccess,
}: {
  goalId: string;
  goalTitle: string;
  onSuccess: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("正在获取定位...");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCurrentLocation().then((loc) => {
      if (!mounted) return;
      if (loc) {
        setLocation(loc);
        setLocationStatus(`已获取定位 ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
      } else {
        setLocationStatus("未获取定位");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
    setMessage(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage("生成人生记录...");
    try {
      const date = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
      const locationText = location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "";
      const watermarked = await createWatermarkImage(file, {
        date,
        location: locationText,
        goalTitle,
      });
      await createLifeRecord(goalId, {
        file: watermarked,
        content: content || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        city: undefined,
        country: undefined,
      });
      setMessage("✨ 记录完成");
      onSuccess();
    } catch {
      setError("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">📷 记录这一刻</p>
        <span className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" />
          {locationStatus}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />

      {preview ? (
        <img src={preview} alt="Preview" className="mb-3 max-h-72 w-full rounded-[10px] object-cover" />
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border bg-surface-muted text-muted"
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm">拍照或选择照片</span>
        </button>
      )}

      <Textarea
        className="mt-3"
        rows={2}
        placeholder="写点什么吧（可选）"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {message && <p className="mt-2 text-xs text-success">{message}</p>}

      <div className="mt-3 flex gap-2">
        {preview && (
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Camera className="h-4 w-4" />
            重选
          </Button>
        )}
        <Button className="flex-1" onClick={upload} disabled={!file || uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {uploading ? "生成人生记录..." : "生成水印并上传"}
        </Button>
      </div>
    </Card>
  );
}
