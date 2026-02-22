import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { parseAssetDocument } from "../src/core/asset-document.js";
import { PROJECT_TYPES } from "../src/core/project-layout.js";
import { createProjectScaffold } from "../src/services/project-service.js";
import {
  buildLogicalWorkspaceTree,
  createAssetFlow,
  createEpisodeFlow,
  createSceneCardFlow,
  reorderScenes,
  searchWorkspace,
  updateAssetCustomField,
  validateDropTarget,
} from "../src/services/workspace-explorer-service.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

function collectBasenames(node, bucket = []) {
  if (!node) {
    return bucket;
  }
  bucket.push(basename(node.path));
  for (const child of node.children ?? []) {
    collectBasenames(child, bucket);
  }
  return bucket;
}

test("logical workspace tree hides storage folders by default", async () => {
  const dir = await makeTmpDir("story-me-explorer-tree-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "01-开场" });

    const logicalTree = await buildLogicalWorkspaceTree(dir, { advancedMode: false });
    const logicalNames = logicalTree.nodes.flatMap((node) => collectBasenames(node));
    assert.equal(logicalNames.includes("媒体"), false);
    assert.equal(logicalNames.includes("分镜"), false);

    const advancedTree = await buildLogicalWorkspaceTree(dir, { advancedMode: true });
    const advancedNames = advancedTree.nodes.flatMap((node) => collectBasenames(node));
    assert.equal(advancedNames.includes("媒体"), true);
    assert.equal(advancedNames.includes("分镜"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guided create flow uses minimal asset fields and supports custom fields", async () => {
  const dir = await makeTmpDir("story-me-explorer-asset-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SINGLE);
    const created = await createAssetFlow(dir, {
      assetType: "角色",
      name: "林月",
      description: "主角",
      image: "lin-yue.png",
    });

    const markdown = await readFile(created.assetDocPath, "utf8");
    const parsed = parseAssetDocument(markdown);
    assert.equal(parsed.fields.name, "林月");
    assert.equal(parsed.fields.description, "主角");
    assert.equal(parsed.fields.image, "lin-yue.png");

    const updated = await updateAssetCustomField(created.assetDocPath, {
      key: "阵营",
      value: "中立",
    });
    assert.equal(updated.fields.customFields["阵营"], "中立");

    const removed = await updateAssetCustomField(created.assetDocPath, {
      key: "阵营",
      remove: true,
    });
    assert.equal(Object.prototype.hasOwnProperty.call(removed.fields.customFields, "阵营"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scene reorder updates persisted order and validates invalid drops", async () => {
  const dir = await makeTmpDir("story-me-explorer-reorder-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "01-开场" });
    await createSceneCardFlow(dir, { episodeName: "EP01", sceneName: "02-茶馆相遇" });

    const reordered = await reorderScenes(dir, "EP01", ["02-茶馆相遇", "01-开场"]);
    const order = JSON.parse(await readFile(reordered.sceneOrderPath, "utf8"));
    assert.deepEqual(order.map((item) => item.sceneName), ["01-茶馆相遇", "02-开场"]);

    await stat(join(dir, "剧本", "EP01", "场次", "01-茶馆相遇.md"));
    await stat(join(dir, "剧本", "EP01", "场次", "02-开场.md"));

    const invalid = validateDropTarget({ dragType: "scene", dropType: "角色" });
    assert.equal(invalid.valid, false);
    assert.match(invalid.reason, /cannot drop/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("search supports query, type and tag filters", async () => {
  const dir = await makeTmpDir("story-me-explorer-search-");
  try {
    await createProjectScaffold(dir, PROJECT_TYPES.SCRIPT_SERIES);
    await createEpisodeFlow(dir, "EP01");
    const scene = await createSceneCardFlow(dir, {
      episodeName: "EP01",
      sceneName: "01-茶馆相遇",
      content: "# 01-茶馆相遇\n\n茶馆场景\n",
    });

    const asset = await createAssetFlow(dir, {
      assetType: "场景",
      name: "茶馆",
      description: "重要场景",
      image: "teahouse.png",
    });
    await updateAssetCustomField(asset.assetDocPath, { key: "tags", value: ["茶馆"] });

    const sceneResults = await searchWorkspace(dir, { query: "茶馆", type: "script" });
    assert.ok(sceneResults.some((item) => item.path === scene.sceneCardPath));

    const assetResults = await searchWorkspace(dir, { tag: "茶馆", type: "asset" });
    assert.ok(assetResults.some((item) => item.path === asset.assetDocPath));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
