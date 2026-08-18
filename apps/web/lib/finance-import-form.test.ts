import assert from "node:assert/strict";
import test from "node:test";

import {
  FINANCE_IMPORT_MAX_FILE_BYTES,
  createScreenshotImportForm,
  validateScreenshotImportFiles,
} from "./finance-import-form";

test("creates one batch field for every selected screenshot", () => {
  const first = new File(["first"], "first.png", { type: "image/png" });
  const second = new File(["second"], "second.webp", { type: "image/webp" });

  const files = createScreenshotImportForm([first, second]).getAll("files") as File[];

  assert.deepEqual(files.map((file) => file.name), ["first.png", "second.webp"]);
});

test("rejects batches outside the screenshot import limits", () => {
  assert.equal(
    validateScreenshotImportFiles(Array.from({ length: 10 }, (_, index) => ({ name: `${index}.png`, size: 1, type: "image/png" }))),
    "一次最多选择 9 张截图。",
  );
  assert.equal(
    validateScreenshotImportFiles([{ name: "holding.gif", size: 1, type: "image/gif" }]),
    "仅支持 PNG、JPEG 或 WebP 格式的截图。",
  );
  assert.equal(
    validateScreenshotImportFiles([{ name: "holding.png", size: FINANCE_IMPORT_MAX_FILE_BYTES + 1, type: "image/png" }]),
    "每张截图不能超过 10 MB。",
  );
});
