export function extractPastedImages(items, files) {
  const fromItems = Array.from(items ?? [])
    .filter((item) => item?.kind === "file" && item.type?.startsWith("image/"))
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
  if (fromItems.length > 0) return fromItems;
  return Array.from(files ?? []).filter((file) => file?.type?.startsWith("image/"));
}
