import { join } from "node:path";

import { normalizeEpisodeName } from "./project-layout.js";
import { sanitizePathSegment } from "./path-utils.js";

const ASSET_CATEGORY_MAP = Object.freeze({
  "资产": "资产",
  "角色": join("资产", "角色"),
  "场景": join("资产", "场景"),
  "道具": join("资产", "道具"),
});

function normalizeNodeType(nodeType) {
  const raw = String(nodeType ?? "").trim();
  if (!raw) {
    throw new Error("target.nodeType is required.");
  }

  const aliases = {
    assets: "资产",
    asset: "资产",
    character: "角色",
    characters: "角色",
    scene: "场景",
    scenes: "场景",
    prop: "道具",
    props: "道具",
    episode: "EP",
    ep: "EP",
    "scene-card": "场次",
  };

  return aliases[raw.toLowerCase()] ?? raw;
}

function resolveIngestTarget(projectRoot, target) {
  const nodeType = normalizeNodeType(target?.nodeType);

  if (ASSET_CATEGORY_MAP[nodeType]) {
    const relativeDir = ASSET_CATEGORY_MAP[nodeType];
    return {
      nodeType,
      basePath: join(projectRoot, relativeDir),
      sceneDocPath: null,
      logicalPath: relativeDir,
    };
  }

  if (nodeType === "EP") {
    const episodeName = normalizeEpisodeName(target?.episodeName);
    const relativeDir = join("剧本", episodeName, "资源");
    return {
      nodeType,
      basePath: join(projectRoot, relativeDir),
      sceneDocPath: null,
      logicalPath: relativeDir,
    };
  }

  if (nodeType === "场次") {
    const episodeName = normalizeEpisodeName(target?.episodeName);
    const sceneName = sanitizePathSegment(target?.sceneName ?? "");
    const sceneRoot = join("剧本", episodeName, "场次", sceneName);
    return {
      nodeType,
      basePath: join(projectRoot, sceneRoot, "媒体"),
      sceneDocPath: join(projectRoot, "剧本", episodeName, "场次", `${sceneName}.md`),
      logicalPath: sceneRoot,
    };
  }

  throw new Error(`Unsupported ingest target nodeType: ${nodeType}`);
}

export { resolveIngestTarget };
