const IMAGE_FILENAME_RE = /\.(?:jpe?g|png|gif|webp)$/i;

function isImageFile(file, hintedType = "") {
  return Boolean(
    file &&
      (file.type?.startsWith("image/") ||
        hintedType?.startsWith("image/") ||
        IMAGE_FILENAME_RE.test(file.name ?? "")),
  );
}

export function extractPastedImages(items, files) {
  const fromItems = Array.from(items ?? [])
    .map((item) => ({ file: item.getAsFile?.(), type: item.type }))
    .filter(({ file, type }) => isImageFile(file, type))
    .map(({ file }) => file);
  if (fromItems.length > 0) return fromItems;
  return Array.from(files ?? []).filter((file) => isImageFile(file));
}
