import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { createEpisode, createProjectScaffold } from "../src/services/project-service.js";
import { IngestService } from "../src/services/ingest-service.js";
import { PROJECT_TYPES } from "../src/core/project-layout.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("supports partial batch failure and progress reporting", async () => {
  const dir = await makeTmpDir("story-me-ingest-partial-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    const sourceDir = join(dir, "source");
    await createProjectScaffold(sourceDir, PROJECT_TYPES.SCRIPT_SINGLE).catch(() => {});
    const validSource = join(dir, "valid.png");
    const missingSource = join(dir, "missing.png");
    await writeFile(validSource, "image-data", "utf8");

    const progressEvents = [];
    const service = new IngestService({ idFactory: (() => {
      let idx = 1;
      return () => `id-${idx++}`;
    })() });

    const result = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "角色" },
      inputs: [validSource, missingSource],
      mode: "copy",
      onProgress: (event) => progressEvents.push(event),
    });

    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.completed, 1);
    assert.equal(result.summary.failed, 1);
    assert.equal(progressEvents.length, 2);
    assert.equal(progressEvents[1].processed, 2);
    assert.equal(result.results.filter((item) => item.status === "success").length, 1);
    assert.equal(result.results.filter((item) => item.status === "failed").length, 1);

    const success = result.results.find((item) => item.status === "success");
    const imported = await readFile(success.destinationPath, "utf8");
    const metadata = JSON.parse(await readFile(success.metadataPath, "utf8"));
    assert.equal(imported, "image-data");
    assert.equal(metadata.asset_id, "id-2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("applies deterministic conflict naming during import", async () => {
  const dir = await makeTmpDir("story-me-ingest-conflict-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);
    const srcDirA = join(dir, "src-a");
    const srcDirB = join(dir, "src-b");
    await createProjectScaffold(srcDirA, PROJECT_TYPES.SCRIPT_SINGLE);
    await createProjectScaffold(srcDirB, PROJECT_TYPES.SCRIPT_SINGLE);
    const srcA = join(srcDirA, "photo.png");
    const srcB = join(srcDirB, "photo.png");
    await writeFile(srcA, "a", "utf8");
    await writeFile(srcB, "b", "utf8");

    const service = new IngestService({ idFactory: (() => {
      let idx = 1;
      return () => `id-${idx++}`;
    })() });

    const result = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "角色" },
      inputs: [srcA, srcB],
      mode: "copy",
    });

    const success = result.results.filter((item) => item.status === "success");
    const names = success.map((item) => basename(item.destinationPath)).sort();

    assert.deepEqual(names, ["photo-2.png", "photo.png"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("updates scene links and supports undo rollback for copy mode", async () => {
  const dir = await makeTmpDir("story-me-ingest-undo-copy-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisode(dir, "EP01");
    const sceneDoc = join(dir, "剧本", "EP01", "场次", "01-开场.md");
    await writeFile(sceneDoc, "# 01-开场\n", "utf8");

    const source = join(dir, "scene-ref.png");
    await writeFile(source, "scene-image", "utf8");

    const service = new IngestService({ idFactory: (() => {
      let idx = 1;
      return () => `id-${idx++}`;
    })() });

    const result = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "场次", episodeName: "EP01", sceneName: "01-开场" },
      inputs: [source],
      mode: "copy",
    });

    const success = result.results[0];
    const sceneAfter = await readFile(sceneDoc, "utf8");
    const metadataAfter = JSON.parse(await readFile(success.metadataPath, "utf8"));
    assert.match(sceneAfter, /\[\[id-2\]\]/);
    assert.deepEqual(metadataAfter.backlinks, ["剧本/EP01/场次/01-开场.md"]);

    await service.undoLastImport();

    const sceneRestored = await readFile(sceneDoc, "utf8");
    assert.equal(sceneRestored, "# 01-开场\n");
    await assert.rejects(() => stat(success.destinationPath));
    await assert.rejects(() => stat(success.metadataPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("supports move mode and undo restores original source", async () => {
  const dir = await makeTmpDir("story-me-ingest-undo-move-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);
    const source = join(dir, "movable.mp3");
    await writeFile(source, "audio", "utf8");

    const service = new IngestService({ idFactory: (() => {
      let idx = 1;
      return () => `id-${idx++}`;
    })() });

    const result = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "道具" },
      inputs: [source],
      mode: "move",
    });

    const success = result.results[0];
    await assert.rejects(() => stat(source));
    await stat(success.destinationPath);

    await service.undoLastImport();

    await stat(source);
    await assert.rejects(() => stat(success.destinationPath));
    await assert.rejects(() => stat(success.metadataPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
