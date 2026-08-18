export const FINANCE_IMPORT_MAX_FILES = 9;
export const FINANCE_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_FINANCE_IMPORT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type ScreenshotImportFile = Pick<File, "name" | "size" | "type">;

export function validateScreenshotImportFiles(files: ScreenshotImportFile[]): string | null {
  if (files.length > FINANCE_IMPORT_MAX_FILES) return "一次最多选择 9 张截图。";
  if (files.some((file) => !SUPPORTED_FINANCE_IMPORT_TYPES.has(file.type))) {
    return "仅支持 PNG、JPEG 或 WebP 格式的截图。";
  }
  if (files.some((file) => file.size > FINANCE_IMPORT_MAX_FILE_BYTES)) {
    return "每张截图不能超过 10 MB。";
  }
  return null;
}

export function createScreenshotImportForm(files: File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return form;
}
