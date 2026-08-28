import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Vercel forwards same-origin API requests to the Render API", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.rewrites, [
    {
      source: "/api/v1/:path*",
      destination: "https://ai-life-os-api-4y3x.onrender.com/api/v1/:path*",
    },
  ]);
});
