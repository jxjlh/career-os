import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");

test("nginx accepts a full finance screenshot batch payload", () => {
  assert.match(config, /client_max_body_size\s+100m;/);
});
