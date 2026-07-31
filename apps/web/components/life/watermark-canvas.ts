export interface WatermarkMeta {
  date: string;
  location: string;
  goalTitle: string;
}

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

export async function createWatermarkImage(file: File, meta: WatermarkMeta): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0);

  const bandHeight = Math.max(96, Math.round(canvas.height * 0.12));
  const pad = 24;
  const base = canvas.height - bandHeight + 14;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.font = `600 ${Math.max(22, canvas.width * 0.02)}px sans-serif`;
  ctx.fillText(meta.date, pad, base);

  ctx.font = `500 ${Math.max(16, canvas.width * 0.014)}px sans-serif`;
  const brand = "AI LifeOS";
  ctx.fillText(brand, canvas.width - pad - ctx.measureText(brand).width, base);

  ctx.font = `400 ${Math.max(16, canvas.width * 0.014)}px sans-serif`;
  wrapText(ctx, `人生目标：${meta.goalTitle}`, pad, base + 30, canvas.width - pad * 2 - 140, 22);

  ctx.fillText(meta.location || "未获取定位", pad, base + 58);

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
