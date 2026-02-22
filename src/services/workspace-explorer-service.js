import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, parse } from "node:path";

import { createAssetDocument, parseAssetDocument } from "../core/asset-document.js";
import { makeDeterministicUniqueName, sanitizePathSegment } from "../core/path-utils.js";
import { createEpisode } from "./project-service.js";

const STORAGE_HIDDEN_DIRS = new Set(["媒体", "分镜", ".storyme", ".internal"]);

function toCategoryFolder(assetType) {
  const normalized = String(assetType).trim();
  const map = {
    "角色": "角色",
    "道具": "道具",
    "场景": "场景",
    character: "角色",
    prop: "道具",
    scene: "场景",
  };
  const folder = map[normalized] ?? map[normalized.toLowerCase()];
  if (!folder) {
    throw new Error(`Unsupported asset type: ${assetType}`);
  }
  return folder;
}

function typeForAssetFolder(folder) {
  const map = {
    "角色": "character",
    "道具": "prop",
    "场景": "scene",
  };
  return map[folder] ?? "asset";
}

function displayNode(path, kind, children = []) {
  return { path, kind, children };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function buildDirTree(rootPath, options = {}) {
  const advancedMode = options.advancedMode ?? false;
  const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
  const children = [];

  for (const entry of entries) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (!advancedMode && STORAGE_HIDDEN_DIRS.has(entry.name)) {
        continue;
      }
      children.push(await buildDirTree(fullPath, options));
    } else if (entry.isFile()) {
      if (!advancedMode && extname(entry.name) === ".meta.json") {
        continue;
      }
      children.push(displayNode(fullPath, "file"));
    }
  }

  return displayNode(rootPath, "dir", children);
}

async function buildLogicalWorkspaceTree(projectRoot, options = {}) {
  const advancedMode = options.advancedMode ?? false;
  const assetsRoot = join(projectRoot, "资产");
  const scriptRoot = join(projectRoot, "剧本");

  const logical = {
    projectRoot,
    nodes: [],
  };

  logical.nodes.push(await buildDirTree(assetsRoot, { advancedMode }));

  const scriptTree = await buildDirTree(scriptRoot, { advancedMode });
  if (!advancedMode) {
    // Flatten scene card folders in logical mode: keep scene markdown files, hide deep storage siblings.
    for (const epNode of scriptTree.children ?? []) {
      if (parse(epNode.path).base.startsWith("EP")) {
        for (const child of epNode.children ?? []) {
          if (parse(child.path).base === "场次") {
            child.children = (child.children ?? []).filter(
              (item) => item.kind === "file" || extname(item.path) === ".md"
            );
          }
        }
      }
    }
  }
  logical.nodes.push(scriptTree);

  return logical;
}

async function createEpisodeFlow(projectRoot, episodeInput) {
  return createEpisode(projectRoot, episodeInput);
}

async function createSceneCardFlow(projectRoot, { episodeName, sceneName, content = "" }) {
  const ep = String(episodeName).trim().toUpperCase();
  const safeScene = sanitizePathSegment(sceneName);
  const scenesRoot = join(projectRoot, "剧本", ep, "场次");
  const sceneCardPath = join(scenesRoot, `${safeScene}.md`);
  const sceneStorageRoot = join(scenesRoot, safeScene);
  const storyboardDir = join(sceneStorageRoot, "分镜");
  const mediaDir = join(sceneStorageRoot, "媒体");

  await mkdir(storyboardDir, { recursive: true });
  await mkdir(mediaDir, { recursive: true });
  if (!(await exists(sceneCardPath))) {
    const seed = content || `# ${safeScene}\n\n`;
    await writeFile(sceneCardPath, seed, "utf8");
  }

  return {
    sceneCardPath,
    sceneStorageRoot,
    storyboardDir,
    mediaDir,
  };
}

async function createAssetFlow(projectRoot, { assetType, name, description = "", image = "" }) {
  const category = toCategoryFolder(assetType);
  const assetsRoot = join(projectRoot, "资产", category);
  await mkdir(assetsRoot, { recursive: true });

  const current = await readdir(assetsRoot, { withFileTypes: true }).catch(() => []);
  const existing = current.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const folderName = makeDeterministicUniqueName(name, existing);
  const assetDir = join(assetsRoot, folderName);
  const assetDocPath = join(assetDir, "asset.md");

  await mkdir(assetDir, { recursive: true });
  const markdown = createAssetDocument({
    type: typeForAssetFolder(category),
    name,
    description,
    image,
    customFields: {},
  });
  await writeFile(assetDocPath, markdown, "utf8");

  return {
    category,
    assetDir,
    assetDocPath,
  };
}

async function updateAssetCustomField(assetDocPath, { key, value, remove = false }) {
  const markdown = await readFile(assetDocPath, "utf8");
  const parsed = parseAssetDocument(markdown);
  const custom = { ...parsed.fields.customFields };

  if (remove) {
    delete custom[key];
  } else {
    custom[key] = value;
  }

  const next = createAssetDocument({
    type: parsed.metadata.type,
    name: parsed.fields.name,
    description: parsed.fields.description,
    image: parsed.fields.image,
    customFields: custom,
    metadata: parsed.metadata,
  });
  await writeFile(assetDocPath, next, "utf8");
  return parseAssetDocument(next);
}

async function reorderScenes(projectRoot, episodeName, orderedSceneNames) {
  const ep = String(episodeName).trim().toUpperCase();
  const scenesRoot = join(projectRoot, "剧本", ep, "场次");
  const sceneOrderPath = join(scenesRoot, ".scene-order.json");
  const manifest = [];
  const fileMoves = [];
  const dirMoves = [];
  for (let index = 0; index < orderedSceneNames.length; index += 1) {
    const rawName = sanitizePathSegment(orderedSceneNames[index]);
    const mdPath = join(scenesRoot, `${rawName}.md`);
    const dirPath = join(scenesRoot, rawName);
    const title = rawName.includes("-") ? rawName.split("-").slice(1).join("-") : rawName;
    const prefix = String(index + 1).padStart(2, "0");
    const nextName = `${prefix}-${title}`;
    const nextMdPath = join(scenesRoot, `${nextName}.md`);
    const nextDirPath = join(scenesRoot, nextName);

    if ((await exists(mdPath)) && rawName !== nextName) {
      const tempMd = `${mdPath}.tmp-${index + 1}`;
      fileMoves.push({ from: mdPath, temp: tempMd, to: nextMdPath });
    }
    if ((await exists(dirPath)) && rawName !== nextName) {
      const tempDir = `${dirPath}.tmp-${index + 1}`;
      dirMoves.push({ from: dirPath, temp: tempDir, to: nextDirPath });
    }

    manifest.push({
      order: index + 1,
      sceneName: nextName,
    });
  }

  for (const move of [...fileMoves, ...dirMoves]) {
    await rename(move.from, move.temp);
  }
  for (const move of [...fileMoves, ...dirMoves]) {
    await rename(move.temp, move.to);
  }

  await writeFile(sceneOrderPath, JSON.stringify(manifest, null, 2), "utf8");
  return {
    sceneOrderPath,
    manifest,
  };
}

function validateDropTarget({ dragType, dropType }) {
  const rules = {
    scene: new Set(["episode", "scenes-root"]),
    asset: new Set(["资产", "角色", "场景", "道具", "scene"]),
    media: new Set(["场次", "scene", "角色", "场景", "道具"]),
  };
  const allowed = rules[dragType] ?? new Set();
  return {
    valid: allowed.has(dropType),
    reason: allowed.has(dropType) ? "" : `Cannot drop ${dragType} on ${dropType}`,
  };
}

async function searchWorkspace(projectRoot, { query = "", type = "", tag = "" } = {}) {
  const tree = await buildLogicalWorkspaceTree(projectRoot, { advancedMode: true });
  const lowerQuery = query.trim().toLowerCase();
  const lowerTag = tag.trim().toLowerCase();
  const lowerType = type.trim().toLowerCase();
  const results = [];

  async function walk(node) {
    if (!node) {
      return;
    }
    if (node.kind === "file" && extname(node.path) === ".md") {
      const content = await readFile(node.path, "utf8").catch(() => "");
      const pathLower = node.path.toLowerCase();
      const queryMatched =
        !lowerQuery || pathLower.includes(lowerQuery) || content.toLowerCase().includes(lowerQuery);
      const tagMatched = !lowerTag || content.toLowerCase().includes(lowerTag);
      const inferredType = pathLower.includes("/资产/") ? "asset" : pathLower.includes("/剧本/") ? "script" : "doc";
      const typeMatched = !lowerType || inferredType === lowerType;

      if (queryMatched && tagMatched && typeMatched) {
        results.push({
          path: node.path,
          type: inferredType,
          title: basename(node.path, ".md"),
        });
      }
    }
    for (const child of node.children ?? []) {
      await walk(child);
    }
  }

  for (const rootNode of tree.nodes) {
    await walk(rootNode);
  }

  return results;
}

export {
  buildLogicalWorkspaceTree,
  createAssetFlow,
  createEpisodeFlow,
  createSceneCardFlow,
  reorderScenes,
  searchWorkspace,
  updateAssetCustomField,
  validateDropTarget,
};
