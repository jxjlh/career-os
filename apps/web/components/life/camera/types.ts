export type CameraMode = "photo" | "video";
export type AspectRatio = "1:1" | "4:3" | "16:9";

export interface AICameraHandle {
  /** 触发拍照, 返回 Blob (image/jpeg). */
  capture: () => Promise<Blob | null>;
  /** 开始录像. 成功返回 true. */
  startRecording: () => Promise<boolean>;
  /** 停止录像, 返回 Blob (video/webm) 与时长(秒). */
  stopRecording: () => Promise<{ blob: Blob; duration: number } | null>;
}
