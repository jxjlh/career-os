export function extractPastedImages(items) {
  return Array.from(items ?? [])
    .filter((item) => item?.kind === "file" && item.type?.startsWith("image/"))
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
}
