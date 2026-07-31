export interface WatermarkMeta {
  date: string;
  time?: string;
  location?: string;
  goalTitle: string;
  city?: string;
  country?: string;
  gps?: string;
  weather?: string;
  temperature?: number | null;
  altitude?: number | null;
}

/** 用户可开关的水印项, 默认全部启用. */
export interface WatermarkOptions {
  date?: boolean;
  time?: boolean;
  location?: boolean;
  city?: boolean;
  weather?: boolean;
  temperature?: boolean;
  altitude?: boolean;
  gps?: boolean;
  logo?: boolean;
}

export const DEFAULT_WATERMARK_OPTIONS: WatermarkOptions = {
  date: true,
  time: true,
  location: true,
  city: true,
  weather: true,
  temperature: true,
  altitude: true,
  gps: true,
  logo: true,
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split("");
  let line = "";
  let cursor = y;
  for (const char of words) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      line = char;
      cursor += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
}

function enabled(opts: WatermarkOptions | undefined, key: keyof WatermarkOptions): boolean {
  return opts?.[key] !== false; // 默认 true, 显式 false 才关闭
}

/**
 * 在照片底部叠加 LifeOS 水印条, 含日期/时间/地点/城市/天气/温度/海拔/GPS/Logo.
 * 用户可通过 options 关闭部分项. 生成失败时返回原文件, 不阻塞拍照流程.
 */
export async function createWatermarkImage(
  file: File,
  meta: WatermarkMeta,
  options: WatermarkOptions = DEFAULT_WATERMARK_OPTIONS,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);

  const bandHeight = Math.max(120, Math.round(canvas.height * 0.16));
  const pad = Math.max(24, Math.round(canvas.width * 0.02));
  const titleSize = Math.max(22, canvas.width * 0.022);
  const bodySize = Math.max(15, canvas.width * 0.013);
  const lineHeight = Math.round(bodySize * 1.5);

  // 半透明黑色渐变底条, 保证文字可读
  const gradient = ctx.createLinearGradient(0, canvas.height - bandHeight, 0, canvas.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.3, "rgba(0,0,0,0.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";

  // 第一行: 日期 + 时间 (左) | Logo (右)
  const titleY = canvas.height - bandHeight + Math.round(pad * 0.6);
  ctx.font = `600 ${titleSize}px sans-serif`;
  const datePart = [
    enabled(options, "date") ? meta.date : "",
    enabled(options, "time") && meta.time ? meta.time : "",
  ]
    .filter(Boolean)
    .join("  ");
  if (datePart) ctx.fillText(datePart, pad, titleY);

  if (enabled(options, "logo")) {
    ctx.font = `600 ${titleSize}px sans-serif`;
    const brand = "AI LifeOS";
    ctx.fillText(brand, canvas.width - pad - ctx.measureText(brand).width, titleY);
  }

  // 第二行起: 目标 / 地点 / 天气 / GPS
  ctx.font = `400 ${bodySize}px sans-serif`;
  let cursorY = titleY + Math.round(titleSize * 1.6);

  const locationLine = buildLocationLine(meta, options);
  if (locationLine) {
    wrapText(ctx, locationLine, pad, cursorY, canvas.width - pad * 2 - 140, lineHeight);
    cursorY += lineHeight * (Math.ceil(ctx.measureText(locationLine).width / (canvas.width - pad * 2 - 140)) || 1);
  }

  const detailLine = buildDetailLine(meta, options);
  if (detailLine) {
    ctx.fillText(detailLine, pad, cursorY);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      } else {
        resolve(file);
      }
    }, "image/jpeg", 0.92);
  });
}

function buildLocationLine(meta: WatermarkMeta, options: WatermarkOptions): string {
  const parts: string[] = [];
  // 目标标题始终作为 LifeOS 身份的一部分展示
  parts.push(`人生目标：${meta.goalTitle}`);
  if (enabled(options, "city")) {
    const cityCountry = [meta.country, meta.city].filter(Boolean).join(" · ");
    if (cityCountry) parts.push(cityCountry);
  }
  // 兼容旧字段: location 为自由文本定位 (老版 camera-capture 传 GPS 字符串)
  if (enabled(options, "location") && meta.location) parts.push(meta.location);
  return parts.join("   ");
}

function buildDetailLine(meta: WatermarkMeta, options: WatermarkOptions): string {
  const parts: string[] = [];
  if (enabled(options, "weather") && meta.weather) parts.push(meta.weather);
  if (enabled(options, "temperature") && meta.temperature != null) parts.push(`${meta.temperature}°C`);
  if (enabled(options, "altitude") && meta.altitude != null) parts.push(`海拔 ${Math.round(meta.altitude)}m`);
  if (enabled(options, "gps") && meta.gps) parts.push(meta.gps);
  return parts.join("   ·   ");
}
