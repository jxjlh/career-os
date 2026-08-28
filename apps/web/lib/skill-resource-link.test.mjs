import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("B站 fallback cards are labeled as searches, not videos", async () => {
  const source = await readFile(new URL("../app/(app)/skills/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resource\.type\s*===\s*["']search["']/);
  assert.match(source, /打开B站搜索/);
});
