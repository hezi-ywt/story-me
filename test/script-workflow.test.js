import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PROJECT_TYPES } from "../src/core/project-layout.js";
import { createProjectScaffold } from "../src/services/project-service.js";
import {
  createAssetFlow,
  createEpisodeFlow,
  createSceneCardFlow,
} from "../src/services/workspace-explorer-service.js";
import {
  getAssetBacklinks,
  getEpisodeWorkspaceBindings,
  getScriptEntryActions,
  insertAssetReferenceInScript,
  saveScriptDocumentWithLock,
  syncSceneOrderMetadata,
} from "../src/services/script-workflow-service.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

test("provides script-first entry actions by project type", () => {
  const single = getScriptEntryActions("script-single").map((item) => item.id);
  const series = getScriptEntryActions("script-series").map((item) => item.id);
  assert.equal(single.includes("new-episode"), false);
  assert.equal(series.includes("new-episode"), true);
});

test("resolves episode workspace bindings and scene order", async () => {
  const dir = await makeTmpDir("story-me-script-bind-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "01-开场" });
    await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "02-茶馆相遇" });

    await syncSceneOrderMetadata(dir, "EP01", ["02-茶馆相遇", "01-开场"]);
    const bindings = await getEpisodeWorkspaceBindings(dir, "EP01");
    assert.deepEqual(bindings.orderedScenes, ["01-茶馆相遇", "02-开场"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("supports asset reference insertion and backlinks", async () => {
  const dir = await makeTmpDir("story-me-script-links-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "01-开场" });

    await insertAssetReferenceInScript(scene.sceneCardPath, {
      assetId: "asset-123",
      label: "林月",
    });
    const backlinks = await getAssetBacklinks(dir, "asset-123");
    assert.ok(backlinks.includes(scene.sceneCardPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("enforces optimistic lock and writes manual merge entry on conflict", async () => {
  const dir = await makeTmpDir("story-me-script-lock-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scriptPath = join(dir, "剧本", "EP01", "剧本.md");
    await writeFile(
      scriptPath,
      ['---', 'rev: 1', 'updated_at: "2026-02-22T00:00:00.000Z"', 'updated_by: "writer-a"', '---', '', '# EP01'].join(
        "\n"
      ),
      "utf8"
    );

    const saved = await saveScriptDocumentWithLock(scriptPath, {
      expectedRev: 1,
      nextBody: "\n# EP01\n\n新内容\n",
      updatedBy: "writer-b",
    });
    assert.equal(saved.status, "saved");

    const conflict = await saveScriptDocumentWithLock(scriptPath, {
      expectedRev: 1,
      nextBody: "\n# EP01\n\n冲突内容\n",
      conflictIncomingContent: "\n# EP01\n\n冲突内容\n",
      updatedBy: "writer-c",
    });
    assert.equal(conflict.status, "conflict");
    await stat(conflict.conflictPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("e2e script workflow runs without render plugin", async () => {
  const dir = await makeTmpDir("story-me-script-e2e-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "01-开场" });
    const asset = await createAssetFlow(dir, {
      assetType: "角色",
      name: "林月",
      description: "主角",
      image: "lin.png",
    });

    await insertAssetReferenceInScript(scene.sceneCardPath, { assetId: "asset-ep01-hero" });
    const backlinks = await getAssetBacklinks(dir, "asset-ep01-hero");
    assert.ok(backlinks.includes(scene.sceneCardPath));

    const saveResult = await saveScriptDocumentWithLock(scene.sceneCardPath, {
      expectedRev: 1,
      nextBody: "# 01-开场\n\n无渲染插件也可完成流程\n",
      updatedBy: "local-user",
    });
    assert.equal(saveResult.status, "saved");

    const assetDoc = await readFile(asset.assetDocPath, "utf8");
    assert.match(assetDoc, /林月/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
