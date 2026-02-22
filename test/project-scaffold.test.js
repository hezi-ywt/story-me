import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeDeterministicUniqueName, sanitizePathSegment } from "../src/core/path-utils.js";
import { PROJECT_TYPES } from "../src/core/project-layout.js";
import { createEpisode, createProjectScaffold } from "../src/services/project-service.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("creates script-single scaffold with Chinese directory names", async () => {
  const dir = await makeTmpDir("story-me-single-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);

    const outlinePath = join(dir, "剧本", "大纲.md");
    const outline = await readFile(outlinePath, "utf8");
    assert.match(outline, /# 大纲/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("creates script-series scaffold and episode structure", async () => {
  const dir = await makeTmpDir("story-me-series-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    const result = await createEpisode(dir, "1");

    assert.equal(result.episodeName, "EP01");
    const outline = await readFile(join(dir, "剧本", "EP01", "大纲.md"), "utf8");
    const script = await readFile(join(dir, "剧本", "EP01", "剧本.md"), "utf8");
    assert.match(outline, /EP01 大纲/);
    assert.match(script, /EP01 剧本/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preserves Unicode path segments and rejects invalid separators", () => {
  assert.equal(sanitizePathSegment("茶馆相遇"), "茶馆相遇");
  assert.throws(() => sanitizePathSegment(""), /cannot be empty/i);
  assert.equal(sanitizePathSegment("01/开场"), "01-开场");
});

test("applies deterministic suffixing for duplicate names", () => {
  const existing = new Set(["林月", "林月-2"]);
  const next = makeDeterministicUniqueName("林月", existing);
  assert.equal(next, "林月-3");
});
