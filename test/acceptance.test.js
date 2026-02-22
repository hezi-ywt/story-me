import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { validateAndMigrateMetadata } from "../src/core/asset-document.js";
import { PROJECT_TYPES } from "../src/core/project-layout.js";
import { createProjectScaffold } from "../src/services/project-service.js";
import { IngestService } from "../src/services/ingest-service.js";
import { createAssetFlow } from "../src/services/workspace-explorer-service.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("sample projects and docs exist for acceptance walkthrough", async () => {
  await stat("samples/script-single-sample/剧本/大纲.md");
  await stat("samples/script-series-sample/剧本/EP01/剧本.md");
  await stat("samples/script-series-sample/资产/场景/茶馆/asset.md");
  await stat("docs/project-schema-and-linking.md");
});

test("validates Chinese naming and deterministic duplicate suffix end-to-end", async () => {
  const dir = await makeTmpDir("story-me-accept-naming-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);
    const first = await createAssetFlow(dir, {
      assetType: "角色",
      name: "林月",
      description: "主角",
      image: "lin-1.png",
    });
    const second = await createAssetFlow(dir, {
      assetType: "角色",
      name: "林月",
      description: "镜像角色",
      image: "lin-2.png",
    });

    assert.equal(basename(first.assetDir), "林月");
    assert.equal(basename(second.assetDir), "林月-2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validates drag-drop copy/move, conflict handling, progress, and undo flows", async () => {
  const dir = await makeTmpDir("story-me-accept-ingest-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);
    const srcDirA = join(dir, "srcA");
    const srcDirB = join(dir, "srcB");
    await createProjectScaffold(srcDirA, PROJECT_TYPES.SCRIPT_SINGLE);
    await createProjectScaffold(srcDirB, PROJECT_TYPES.SCRIPT_SINGLE);
    const a = join(srcDirA, "photo.png");
    const b = join(srcDirB, "photo.png");
    await writeFile(a, "a", "utf8");
    await writeFile(b, "b", "utf8");

    const progressEvents = [];
    const service = new IngestService();
    const copyResult = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "角色" },
      inputs: [a, b],
      mode: "copy",
      onProgress: (event) => progressEvents.push(event),
    });

    assert.equal(copyResult.summary.completed, 2);
    assert.equal(progressEvents.length, 2);
    const names = copyResult.results
      .filter((item) => item.status === "success")
      .map((item) => basename(item.destinationPath))
      .sort();
    assert.deepEqual(names, ["photo-2.png", "photo.png"]);

    await service.undoLastImport();
    for (const item of copyResult.results.filter((entry) => entry.status === "success")) {
      await assert.rejects(() => stat(item.destinationPath));
      await assert.rejects(() => stat(item.metadataPath));
    }

    const moveSource = join(dir, "move-me.mp3");
    await writeFile(moveSource, "audio", "utf8");
    const moveResult = await service.ingestBatch({
      projectRoot: dir,
      target: { nodeType: "道具" },
      inputs: [moveSource],
      mode: "move",
    });
    const moved = moveResult.results.find((item) => item.status === "success");
    await assert.rejects(() => stat(moveSource));
    await stat(moved.destinationPath);

    await service.undoLastImport();
    await stat(moveSource);
    await assert.rejects(() => stat(moved.destinationPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validates metadata migration for legacy local projects", () => {
  const migrated = validateAndMigrateMetadata(
    {
      type: "character",
      name: "旧角色",
    },
    {
      idFactory: () => "legacy-asset-001",
      now: "2026-02-22T00:00:00.000Z",
      updatedBy: "migration-tool",
    }
  );

  assert.equal(migrated.valid, true);
  assert.equal(migrated.metadata.asset_id, "legacy-asset-001");
  assert.equal(migrated.metadata.rev, 1);
  assert.equal(migrated.metadata.updated_by, "migration-tool");
  assert.ok(migrated.migratedFields.includes("schema_version"));
  assert.ok(migrated.migratedFields.includes("updated_at"));
});
