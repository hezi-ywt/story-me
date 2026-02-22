import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";

import { makeDeterministicUniqueFilename, sanitizePathSegment } from "../core/path-utils.js";
import { PROJECT_TYPES } from "../core/project-layout.js";
import { IngestService } from "../services/ingest-service.js";
import { buildUnifiedPreview } from "../services/preview-service.js";
import { createEpisode, createProjectScaffold } from "../services/project-service.js";
import { buildLogicalWorkspaceTree, createAssetFlow, searchWorkspace } from "../services/workspace-explorer-service.js";
import { ApiError, notFoundError, runtimeError, validationError } from "./api-errors.js";
import { ensureString, optionalString, parseJsonBody, toBoolean, toInteger } from "./http-utils.js";

const TEXT_FILE_EXTENSIONS = new Set([".md", ".txt", ".srt", ".json"]);
const IMAGE_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const AUDIO_FILE_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".ogg"]);
const VIDEO_FILE_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const ALLOWED_IMPORT_MODES = new Set(["copy", "move"]);

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

function normalizePathForMatch(path) {
  return String(path).replace(/\\/g, "/");
}

function inferMediaKind(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (IMAGE_FILE_EXTENSIONS.has(ext)) {
    return "image";
  }
  if (AUDIO_FILE_EXTENSIONS.has(ext)) {
    return "audio";
  }
  if (VIDEO_FILE_EXTENSIONS.has(ext)) {
    return "video";
  }
  if (TEXT_FILE_EXTENSIONS.has(ext)) {
    return "text";
  }
  return "file";
}

function mediaBucket(kind) {
  if (kind === "image") {
    return "images";
  }
  if (kind === "video") {
    return "videos";
  }
  if (kind === "audio") {
    return "audio";
  }
  return "files";
}

function inferTargetFromDocumentPath(projectRoot, docPath) {
  const project = normalizePathForMatch(resolve(projectRoot));
  const doc = normalizePathForMatch(resolve(docPath));
  if (doc !== project && !doc.startsWith(`${project}/`)) {
    throw validationError("Document path must be inside projectRoot.");
  }

  const relativePath = doc.slice(project.length).replace(/^\/+/, "");
  const sceneMatch = /^剧本\/(EP\d+)\/场次\/([^/]+)\.md$/i.exec(relativePath);
  if (sceneMatch) {
    return {
      mode: "service",
      target: {
        nodeType: "场次",
        episodeName: sceneMatch[1].toUpperCase(),
        sceneName: sceneMatch[2],
      },
    };
  }

  const episodeDocMatch = /^剧本\/(EP\d+)\/[^/]+\.md$/i.exec(relativePath);
  if (episodeDocMatch) {
    return {
      mode: "service",
      target: {
        nodeType: "EP",
        episodeName: episodeDocMatch[1].toUpperCase(),
      },
    };
  }

  if (/^资产\/(角色|场景|道具)\/[^/]+\/asset\.md$/i.test(relativePath)) {
    const assetMediaBase = join(dirname(docPath), "媒体");
    return {
      mode: "custom-folder",
      target: {
        nodeType: "资产文档",
        basePath: assetMediaBase,
        logicalPath: normalizePathForMatch(relative(projectRoot, assetMediaBase)),
      },
    };
  }

  throw validationError("This document does not support drag-import target inference.", {
    docPath,
    supported:
      "资产/*/asset.md, 剧本/EPxx/剧本.md, 剧本/EPxx/大纲.md, 剧本/EPxx/场次/*.md",
  });
}

function markdownSnippetForImportedFile({ docPath, destinationPath }) {
  const linkPath = encodeURI(normalizePathForMatch(relative(dirname(docPath), destinationPath)));
  const label = destinationPath.split(/[\\/]/).pop();
  const kind = inferMediaKind(destinationPath);

  if (kind === "image") {
    return `![${label}](${linkPath})`;
  }
  if (kind === "audio") {
    return `<audio controls src="${linkPath}"></audio>`;
  }
  if (kind === "video") {
    return `<video controls src="${linkPath}"></video>`;
  }
  if (kind === "text") {
    return `[📄 ${label}](${linkPath})`;
  }
  return `[${label}](${linkPath})`;
}

function appendImportedSnippets(markdown, snippets) {
  const heading = "## 媒体资源";
  const base = String(markdown ?? "").replace(/\s+$/, "");
  const uniqueSnippets = snippets.filter((snippet) => !base.includes(snippet));
  if (uniqueSnippets.length === 0) {
    return base ? `${base}\n` : "";
  }

  if (!base) {
    return `${heading}\n${uniqueSnippets.join("\n")}\n`;
  }

  if (base.includes(heading)) {
    return `${base}\n${uniqueSnippets.join("\n")}\n`;
  }

  return `${base}\n\n${heading}\n${uniqueSnippets.join("\n")}\n`;
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

function validateMode(mode) {
  if (!ALLOWED_IMPORT_MODES.has(mode)) {
    throw validationError(`Unsupported import mode: ${mode}`, {
      allowed: [...ALLOWED_IMPORT_MODES],
    });
  }
}

async function materializeUploadedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw validationError("files must be a non-empty array.");
  }

  const baseDir = await mkdtemp(join(tmpdir(), "story-me-ui-upload-"));
  const items = [];

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
    items.push({
      sourceName,
      path: output,
    });
  }

  return {
    baseDir,
    items,
  };
}

function sortedResults(results) {
  return [...results].sort((left, right) => left.path.localeCompare(right.path));
}

async function moveFile(source, destination) {
  try {
    await rename(source, destination);
  } catch (error) {
    if (error && error.code !== "EXDEV") {
      throw error;
    }
    await cp(source, destination, { force: false });
    await rm(source, { force: true });
  }
}

async function importIntoCustomFolder({ projectRoot, target, mode, uploadedItems }) {
  const basePath = target.basePath;
  await mkdir(basePath, { recursive: true });

  let completed = 0;
  const results = [];
  for (const item of uploadedItems) {
    try {
      const kind = inferMediaKind(item.sourceName);
      const bucket = mediaBucket(kind);
      const bucketDir = join(basePath, bucket);
      await mkdir(bucketDir, { recursive: true });
      const existingNames = await readdir(bucketDir).catch(() => []);
      const destinationName = makeDeterministicUniqueFilename(item.sourceName, existingNames);
      const destinationPath = join(bucketDir, destinationName);

      if (mode === "move") {
        await moveFile(item.path, destinationPath);
      } else {
        await cp(item.path, destinationPath, { force: false });
      }

      const metadataPath = `${destinationPath}.meta.json`;
      const assetId = randomUUID();
      const metadata = {
        schema_version: 1,
        asset_id: assetId,
        media_type: kind,
        source_path: item.sourceName,
        stored_path: destinationPath,
        target_node: target.nodeType,
        target_logical_path: target.logicalPath,
        backlinks: [],
      };
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

      completed += 1;
      results.push({
        sourcePath: item.sourceName,
        status: "success",
        destinationPath,
        metadataPath,
        assetId,
      });
    } catch (error) {
      results.push({
        sourcePath: item.sourceName,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    mode,
    target: {
      nodeType: target.nodeType,
      logicalPath: target.logicalPath,
      basePath: target.basePath,
    },
    summary: {
      total: uploadedItems.length,
      completed,
      failed: uploadedItems.length - completed,
    },
    results,
    transactionId: randomUUID(),
  };
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
  return createProjectScaffold(projectRoot, type);
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
  validateMode(mode);
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
  validateMode(mode);
  const contextDocPath = optionalString(body.contextDocPath).trim();

  const uploaded = await materializeUploadedFiles(body.files);
  try {
    const ingestService = new IngestService({ idFactory: () => randomUUID() });
    const result = await ingestService.ingestBatch({
      projectRoot,
      target,
      inputs: uploaded.items.map((item) => item.path),
      mode,
      contextDocPath: contextDocPath ? resolve(contextDocPath) : null,
    });
    return {
      ...result,
      uploadedCount: uploaded.items.length,
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

async function handleDocumentIngest(request) {
  const body = await parseJsonBody(request, { limitBytes: 120 * 1024 * 1024 });
  const projectRoot = resolve(ensureString(body.projectRoot, "projectRoot"));
  const docPath = resolve(ensureString(body.docPath, "docPath"));
  const mode = optionalString(body.mode).trim() || "copy";
  validateMode(mode);

  const files = body.files;
  if (!Array.isArray(files) || files.length === 0) {
    throw validationError("files must be a non-empty array.");
  }

  const targetDescriptor = inferTargetFromDocumentPath(projectRoot, docPath);
  const previous = await readFile(docPath, "utf8").catch(() => {
    throw notFoundError(`Document not found: ${docPath}`);
  });

  const uploaded = await materializeUploadedFiles(files);
  try {
    let ingestResult;
    if (targetDescriptor.mode === "custom-folder") {
      ingestResult = await importIntoCustomFolder({
        projectRoot,
        target: targetDescriptor.target,
        mode,
        uploadedItems: uploaded.items,
      });
    } else {
      const ingestService = new IngestService({ idFactory: () => randomUUID() });
      ingestResult = await ingestService.ingestBatch({
        projectRoot,
        target: targetDescriptor.target,
        mode,
        inputs: uploaded.items.map((item) => item.path),
        contextDocPath: null,
      });
    }

    const snippets = ingestResult.results
      .filter((item) => item.status === "success")
      .map((item) =>
        markdownSnippetForImportedFile({
          docPath,
          destinationPath: item.destinationPath,
        })
      );

    const nextContent = appendImportedSnippets(previous, snippets);
    await writeFile(docPath, nextContent, "utf8");
    const docStats = await stat(docPath);

    return {
      docPath,
      target: targetDescriptor.target,
      summary: ingestResult.summary,
      results: ingestResult.results,
      appendedSnippets: snippets,
      content: nextContent,
      updatedAt: docStats.mtime.toISOString(),
    };
  } finally {
    await rm(uploaded.baseDir, { recursive: true, force: true });
  }
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
  if (method === "POST" && pathname === "/api/document/ingest") {
    return handleDocumentIngest(request);
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
    return await routeApi(request, url);
  } catch (error) {
    throw normalizeServiceError(error);
  }
}

export { dispatchApi };
