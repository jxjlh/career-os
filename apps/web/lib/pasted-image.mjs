export function extractPastedImages(items, files) {
  const fromItems = Array.from(items ?? [])
    .filter((item) => item?.kind === "file")
    .map((item) => ({ file: item.getAsFile?.(), type: item.type }))
    .filter(({ file, type }) => file && (file.type?.startsWith("image/") || type?.startsWith("image/")))
    .map(({ file }) => file);
  if (fromItems.length > 0) return fromItems;
  return Array.from(files ?? []).filter((file) => file?.type?.startsWith("image/"));
}
