import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("skill creation exposes API errors instead of failing silently", async () => {
  const source = await readFile(new URL("../app/(app)/skills/page.tsx", import.meta.url), "utf8");
  assert.match(source, /createSkill[\s\S]*?onError:/);
  assert.match(source, /role=\"alert\"/);
});
