import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractPastedImages } from "./pasted-image.mjs";

test("extracts image files from clipboard items", () => {
  const image = new File(["png"], "clipboard.png", { type: "image/png" });
  const text = { kind: "string", type: "text/plain" };
  const item = { kind: "file", type: "image/png", getAsFile: () => image };

  assert.deepEqual(extractPastedImages([text, item]), [image]);
});

test("ignores non-image clipboard files", () => {
  const pdf = new File(["pdf"], "clipboard.pdf", { type: "application/pdf" });
  const item = { kind: "file", type: "application/pdf", getAsFile: () => pdf };

  assert.deepEqual(extractPastedImages([item]), []);
});

test("journal and chat inputs wire clipboard image handling", async () => {
  const [journal, contacts] = await Promise.all([
    readFile(new URL("../components/journal/editor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/contacts/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(journal, /onPaste=\{\(e\) => void handlePaste\(e\)\}/);
  assert.match(contacts, /extractPastedImages\(e\.clipboardData\.items\)/);
});
