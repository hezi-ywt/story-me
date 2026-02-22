import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PROJECT_TYPES } from "../src/core/project-layout.js";
import { createProjectScaffold } from "../src/services/project-service.js";
import { createEpisodeFlow, createSceneCardFlow } from "../src/services/workspace-explorer-service.js";
import { buildUnifiedPreview, isScenePreviewReady } from "../src/services/preview-service.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("builds unified preview for markdown and linked media", async () => {
  const dir = await makeTmpDir("story-me-preview-basic-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, {
      episodeName: "EP01",
      sceneName: "01-开场",
      content: "# 开场\n\n测试内容\n",
    });

    await writeFile(join(scene.mediaDir, "a.png"), "img", "utf8");
    await writeFile(join(scene.mediaDir, "b.mp4"), "video", "utf8");
    await writeFile(join(scene.mediaDir, "c.mp3"), "audio", "utf8");
    await writeFile(join(scene.mediaDir, "d.flac"), "unsupported", "utf8");

    await writeFile(join(scene.storyboardDir, "001.md"), "# shot 001", "utf8");
    await mkdir(join(scene.storyboardDir, "001"), { recursive: true });
    await writeFile(join(scene.storyboardDir, "001", "ref.png"), "img", "utf8");

    const preview = await buildUnifiedPreview(scene.sceneCardPath, { limit: 50 });
    assert.match(preview.markdown, /测试内容/);
    assert.equal(preview.groups.references.length, 4);
    assert.equal(preview.groups.storyboard.length, 1);
    assert.ok(preview.groups.references.some((item) => item.mediaType === "image"));
    assert.ok(preview.groups.references.some((item) => item.mediaType === "video"));
    assert.ok(preview.groups.references.some((item) => item.mediaType === "audio"));
    assert.ok(preview.groups.references.some((item) => item.supported === false));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("supports lazy loading for large media scenes", async () => {
  const dir = await makeTmpDir("story-me-preview-lazy-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, {
      episodeName: "EP01",
      sceneName: "02-茶馆相遇",
      content: "# 茶馆相遇",
    });

    for (let i = 0; i < 60; i += 1) {
      await writeFile(join(scene.mediaDir, `${String(i).padStart(3, "0")}.png`), "img", "utf8");
    }

    const started = Date.now();
    const preview = await buildUnifiedPreview(scene.sceneCardPath, { offset: 0, limit: 10 });
    const duration = Date.now() - started;

    assert.equal(preview.media.visible.length, 10);
    assert.ok(preview.media.deferred >= 50);
    assert.ok(duration < 1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("provides fallback metadata for unsupported formats without crashing", async () => {
  const dir = await makeTmpDir("story-me-preview-fallback-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, {
      episodeName: "EP01",
      sceneName: "03-身份揭示",
    });
    await writeFile(join(scene.mediaDir, "clip.xyz"), "binary", "utf8");

    const ready = await isScenePreviewReady(scene.sceneCardPath);
    assert.equal(ready, true);

    const preview = await buildUnifiedPreview(scene.sceneCardPath, { limit: 10 });
    assert.equal(preview.groups.references.length, 1);
    assert.equal(preview.groups.references[0].supported, false);
    assert.match(preview.groups.references[0].fallbackMessage, /unsupported media format/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
