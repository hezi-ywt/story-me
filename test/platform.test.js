import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DesktopPlatformAdapter } from "../src/platform/desktop-adapter.js";
import { IncrementalIndexer } from "../src/platform/indexer.js";
import {
  RenderPluginRegistry,
  validateRenderPluginManifest,
} from "../src/platform/render-extension-contract.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("desktop adapter and indexer support incremental updates", async () => {
  const dir = await makeTmpDir("story-me-platform-");
  try {
    const adapter = new DesktopPlatformAdapter();
    await writeFile(join(dir, "doc.md"), "# test\n", "utf8");
    await writeFile(join(dir, "clip.mp4"), "video", "utf8");

    const list = await adapter.listEntries(dir);
    assert.ok(list.some((item) => item.path.endsWith("doc.md")));

    const media = await adapter.probeMedia(join(dir, "clip.mp4"));
    assert.equal(media.mediaType, "video");

    const indexer = new IncrementalIndexer(adapter);
    const snapshot = await indexer.buildInitialIndex(dir);
    assert.ok(snapshot.total >= 2);
    assert.ok((snapshot.byType["doc"] ?? 0) >= 1);

    indexer.applyFsEvent({ eventType: "rename", path: join(dir, "doc.md"), removed: true });
    const afterRemove = indexer.snapshot();
    assert.equal(afterRemove.entries.some((entry) => entry.path.endsWith("doc.md")), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("watcher wiring updates index on filesystem change", async () => {
  const dir = await makeTmpDir("story-me-platform-watch-");
  try {
    const adapter = new DesktopPlatformAdapter();
    const indexer = new IncrementalIndexer(adapter);
    await indexer.buildInitialIndex(dir);
    const stop = indexer.watch(dir);

    const target = join(dir, "new-scene.md");
    await writeFile(target, "# scene\n", "utf8");

    let observed = false;
    for (let i = 0; i < 20; i += 1) {
      const snapshot = indexer.snapshot();
      if (snapshot.entries.some((entry) => entry.path === target)) {
        observed = true;
        break;
      }
      await sleep(50);
    }

    stop();
    assert.equal(observed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("render plugin contract validates manifests and registry enforces schema", () => {
  const manifest = {
    id: "mock-render",
    version: "0.1.0",
    commands: [
      {
        name: "submit",
        input: "manifest.json",
        output: "output/",
        status: "queued|running|done|failed",
        errors: "string[]",
      },
    ],
  };

  const valid = validateRenderPluginManifest(manifest);
  assert.equal(valid.valid, true);

  const invalid = validateRenderPluginManifest({ id: "bad" });
  assert.equal(invalid.valid, false);

  const registry = new RenderPluginRegistry();
  registry.register(manifest);
  assert.equal(registry.get("mock-render")?.id, "mock-render");
  assert.equal(registry.list().length, 1);
});
