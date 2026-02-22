import { randomUUID } from "node:crypto";
import { stat, writeFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";

import { sanitizePathSegment } from "../core/path-utils.js";
import { PROJECT_TYPES } from "../core/project-layout.js";
import { IngestService } from "../services/ingest-service.js";
import { buildUnifiedPreview } from "../services/preview-service.js";
import { createEpisode, createProjectScaffold } from "../services/project-service.js";
import { buildLogicalWorkspaceTree, createAssetFlow, searchWorkspace } from "../services/workspace-explorer-service.js";
import { ApiError, notFoundError, runtimeError, validationError } from "./api-errors.js";
import { ensureString, optionalString, parseJsonBody, toBoolean, toInteger } from "./http-utils.js";

function normalizeServiceError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("required") || message.includes("Unsupported") || message.includes("Invalid")) {
    return validationError(message);
  }
  return runtimeError(message);
}

function projectTypeFromInput(value) {
  const candidate = optionalString(value).trim() || PROJECT_TYPES.SCRIPT_SINGLE;
  if (!Object.values(PROJECT_TYPES).includes(candidate)) {
    throw validationError(`Unsupported project type: ${candidate}`, {
      allowed: Object.values(PROJECT_TYPES),
    });
  }
  return candidate;
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object") {
    throw validationError("target is required.");
  }

  const nodeType = ensureString(target.nodeType, "target.nodeType");
  const normalized = { nodeType };
  const lower = nodeType.toLowerCase();

  if (lower === "ep" || lower === "episode") {
    normalized.nodeType = "EP";
  }
  if (lower === "scene-card" || lower === "scenecard" || lower === "scene_card" || nodeType === "场次") {
    normalized.nodeType = "场次";
  }

  if (normalized.nodeType === "EP") {
    normalized.episodeName = ensureString(target.episodeName, "target.episodeName");
  }
  if (normalized.nodeType === "场次") {
    normalized.episodeName = ensureString(target.episodeName, "target.episodeName");
    normalized.sceneName = ensureString(target.sceneName, "target.sceneName");
  }

  return normalized;
}

async function materializeUploadedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw validationError("files must be a non-empty array.");
  }
  const baseDir = await mkdtemp(join(tmpdir(), "story-me-ui-upload-"));
  const paths = [];

  for (let index = 0; index < files.length; index += 1) {
    const item = files[index];
    if (!item || typeof item !== "object") {
      throw validationError(`files[${index}] must be an object.`);
    }

    const sourceName = optionalString(item.name).trim() || `upload-${index + 1}.bin`;
    const safeName = sanitizePathSegment(sourceName);
    const rawBase64 = optionalString(item.base64).trim();
    if (!rawBase64) {
      throw validationError(`files[${index}].base64 is required.`);
    }

    let buffer;
    try {
      buffer = Buffer.from(rawBase64, "base64");
    } catch {
      throw validationError(`files[${index}].base64 is not valid base64.`);
    }

    const output = join(baseDir, `${String(index + 1).padStart(2, "0")}-${safeName}`);
    await writeFile(output, buffer);
    paths.push(output);
  }

  return {
    baseDir,
    paths,
  };
}

function sortedResults(results) {
  return [...results].sort((left, right) => left.path.localeCompare(right.path));
}

async function handleGetTree(url) {
  const projectRoot = resolve(ensureString(url.searchParams.get("projectRoot"), "projectRoot"));
  const advancedMode = toBoolean(url.searchParams.get("advancedMode"), false);
  const tree = await buildLogicalWorkspaceTree(projectRoot, { advancedMode });
  return { projectRoot, advancedMode, tree };
}

async function handleProjectInit(request) {
  const body = await parseJsonBody(request);
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const type = projectTypeFromInput(body.type);
  const result = await createProjectScaffold(projectRoot, type);
  return result;
}

async function handleEpisodeCreate(request) {
  const body = await parseJsonBody(request);
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const episode = ensureString(body.episode, "episode");
  return createEpisode(projectRoot, episode);
}

async function handleAssetCreate(request) {
  const body = await parseJsonBody(request);
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const assetType = ensureString(body.assetType, "assetType");
  const name = ensureString(body.name, "name");
  const description = optionalString(body.description).trim();
  const image = optionalString(body.image).trim();
  return createAssetFlow(projectRoot, {
    assetType,
    name,
    description,
    image,
  });
}

async function handleIngest(request) {
  const body = await parseJsonBody(request, { limitBytes: 80 * 1024 * 1024 });
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const target = normalizeTarget(body.target);
  const mode = optionalString(body.mode).trim() || "copy";
  const contextDocPath = optionalString(body.contextDocPath).trim();

  const rawInputs = body.inputs;
  if (!Array.isArray(rawInputs) || rawInputs.length === 0) {
    throw validationError("inputs must be a non-empty array.");
  }
  const inputs = rawInputs.map((value) => resolve(ensureString(value, "inputs[]")));

  const ingestService = new IngestService({ idFactory: () => randomUUID() });
  return ingestService.ingestBatch({
    projectRoot,
    target,
    inputs,
    mode,
    contextDocPath: contextDocPath ? resolve(contextDocPath) : null,
  });
}

async function handleIngestUpload(request) {
  const body = await parseJsonBody(request, { limitBytes: 120 * 1024 * 1024 });
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const target = normalizeTarget(body.target);
  const mode = optionalString(body.mode).trim() || "copy";
  const contextDocPath = optionalString(body.contextDocPath).trim();

  const uploaded = await materializeUploadedFiles(body.files);
  try {
    const ingestService = new IngestService({ idFactory: () => randomUUID() });
    const result = await ingestService.ingestBatch({
      projectRoot,
      target,
      inputs: uploaded.paths,
      mode,
      contextDocPath: contextDocPath ? resolve(contextDocPath) : null,
    });
    return {
      ...result,
      uploadedCount: uploaded.paths.length,
    };
  } finally {
    await rm(uploaded.baseDir, { recursive: true, force: true });
  }
}

async function handleSearch(url) {
  const projectRoot = resolve(ensureString(url.searchParams.get("projectRoot"), "projectRoot"));
  const query = optionalString(url.searchParams.get("query")).trim();
  const type = optionalString(url.searchParams.get("type")).trim().toLowerCase();
  const tag = optionalString(url.searchParams.get("tag")).trim();

  const results = await searchWorkspace(projectRoot, { query, type, tag });
  const sorted = sortedResults(results);
  return {
    count: sorted.length,
    results: sorted,
  };
}

async function handleReadDocument(url) {
  const path = resolve(ensureString(url.searchParams.get("path"), "path"));
  try {
    const content = await readFile(path, "utf8");
    const stats = await stat(path);
    return {
      path,
      content,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw notFoundError(`Document not found: ${path}`);
    }
    throw error;
  }
}

async function handleSaveDocument(request) {
  const body = await parseJsonBody(request, { limitBytes: 30 * 1024 * 1024 });
  const path = resolve(ensureString(body.path, "path"));
  const content = ensureString(body.content, "content", { allowEmpty: true });
  await writeFile(path, content, "utf8");
  const stats = await stat(path);
  return {
    path,
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
  };
}

async function handlePreview(url) {
  const sceneDocPath = resolve(ensureString(url.searchParams.get("sceneDocPath"), "sceneDocPath"));
  const offset = toInteger(url.searchParams.get("offset"), 0);
  const limit = toInteger(url.searchParams.get("limit"), 30);
  return buildUnifiedPreview(sceneDocPath, { offset, limit });
}

function handleFile(url) {
  const path = resolve(ensureString(url.searchParams.get("path"), "path"));
  return {
    kind: "file",
    path,
    root: dirname(path),
  };
}

async function routeApi(request, url) {
  const { method } = request;
  const { pathname } = url;

  if (method === "GET" && pathname === "/api/health") {
    return { ok: true, now: new Date().toISOString() };
  }

  if (method === "POST" && pathname === "/api/project/init") {
    return handleProjectInit(request);
  }
  if (method === "GET" && pathname === "/api/workspace/tree") {
    return handleGetTree(url);
  }
  if (method === "POST" && pathname === "/api/workspace/episode") {
    return handleEpisodeCreate(request);
  }
  if (method === "POST" && pathname === "/api/workspace/asset") {
    return handleAssetCreate(request);
  }
  if (method === "POST" && pathname === "/api/workspace/ingest") {
    return handleIngest(request);
  }
  if (method === "POST" && pathname === "/api/workspace/ingest-upload") {
    return handleIngestUpload(request);
  }
  if (method === "GET" && pathname === "/api/workspace/search") {
    return handleSearch(url);
  }
  if (method === "GET" && pathname === "/api/document") {
    return handleReadDocument(url);
  }
  if (method === "POST" && pathname === "/api/document/save") {
    return handleSaveDocument(request);
  }
  if (method === "GET" && pathname === "/api/preview") {
    return handlePreview(url);
  }
  if (method === "GET" && pathname === "/api/file") {
    return handleFile(url);
  }

  throw notFoundError(`Unknown API endpoint: ${method} ${pathname}`);
}

async function dispatchApi(request, url) {
  try {
    const result = await routeApi(request, url);
    return result;
  } catch (error) {
    throw normalizeServiceError(error);
  }
}

export { dispatchApi };
