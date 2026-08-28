import assert from "node:assert/strict";
import test from "node:test";

import { getApiErrorMessage } from "./api-errors.ts";

test("turns browser network failures into an actionable message", () => {
  assert.equal(
    getApiErrorMessage(new TypeError("Failed to fetch")),
    "网络连接失败，请检查网络后重试；如果问题持续，请稍后再试。",
  );
});

test("preserves a server error message", () => {
  assert.equal(getApiErrorMessage(new Error("JD 服务暂不可用")), "JD 服务暂不可用");
});
