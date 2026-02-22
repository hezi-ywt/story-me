import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";

const SUPPORTED_IMAGE_FORMATS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const SUPPORTED_VIDEO_FORMATS = new Set([".mp4", ".mov", ".webm"]);
const SUPPORTED_AUDIO_FORMATS = new Set([".mp3", ".wav", ".m4a"]);

function mediaTypeFromExtension(path) {
  const ext = extname(path).toLowerCase();
  if (SUPPORTED_IMAGE_FORMATS.has(ext)) {
    return "image";
  }
  if (SUPPORTED_VIDEO_FORMATS.has(ext)) {
    return "video";
  }
  if (SUPPORTED_AUDIO_FORMATS.has(ext)) {
    return "audio";
  }
  return "unsupported";
}

function toPreviewItem(path) {
  const mediaType = mediaTypeFromExtension(path);
  const supported = mediaType !== "unsupported";
  return {
    id: path,
    path,
    title: basename(path),
    mediaType,
    supported,
    fallbackMessage: supported
      ? ""
      : "Unsupported media format in current runtime. Metadata-only fallback enabled.",
  };
}

async function listFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => join(dirPath, entry.name));
}

async function listSubdirs(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(dirPath, entry.name));
}

async function loadStoryboardGroups(storyboardDir) {
  const files = await listFiles(storyboardDir);
  const shotMdFiles = files.filter((path) => extname(path).toLowerCase() === ".md").sort();
  const groups = [];

  for (const shotPath of shotMdFiles) {
    const shotBase = parse(shotPath).name;
    const refDir = join(storyboardDir, shotBase);
    const refs = (await listFiles(refDir)).map((path) => toPreviewItem(path));
    groups.push({
      id: `shot-${shotBase}`,
      title: shotBase,
      shotPath,
      references: refs,
    });
  }

  return groups;
}

function paginate(items, { offset = 0, limit = 20 } = {}) {
  const start = Math.max(0, offset);
  const end = Math.max(start, start + Math.max(0, limit));
  const visible = items.slice(start, end);
  return {
    total: items.length,
    visible,
    offset: start,
    limit,
    deferred: Math.max(0, items.length - end),
  };
}

async function buildUnifiedPreview(sceneDocPath, options = {}) {
  const { offset = 0, limit = 20 } = options;
  const sceneRoot = sceneDocPath.replace(/\.md$/i, "");
  const mediaDir = join(sceneRoot, "媒体");
  const storyboardDir = join(sceneRoot, "分镜");

  const markdown = await readFile(sceneDocPath, "utf8").catch(() => "");
  const mediaFiles = await listFiles(mediaDir);
  const referenceItems = mediaFiles.map((path) => toPreviewItem(path));
  const storyboardGroups = await loadStoryboardGroups(storyboardDir);

  const combined = [
    ...referenceItems.map((item) => ({ group: "references", item })),
    ...storyboardGroups.flatMap((group) =>
      group.references.map((item) => ({ group: `storyboard:${group.title}`, item }))
    ),
  ];
  const paged = paginate(combined, { offset, limit });

  return {
    sceneDocPath,
    markdown,
    groups: {
      references: referenceItems,
      storyboard: storyboardGroups,
    },
    media: paged,
  };
}

async function isScenePreviewReady(sceneDocPath) {
  try {
    await stat(sceneDocPath);
    return true;
  } catch {
    return false;
  }
}

export {
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  buildUnifiedPreview,
  isScenePreviewReady,
  mediaTypeFromExtension,
};
