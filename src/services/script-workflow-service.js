import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { reorderScenes } from "./workspace-explorer-service.js";

function nowIso() {
  return new Date().toISOString();
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) {
    return { frontmatter: {}, body: markdown };
  }

  const frontmatter = {};
  const header = markdown.slice(4, end);
  const body = markdown.slice(end + 5);
  for (const line of header.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (/^\d+$/.test(value)) {
      frontmatter[key] = Number.parseInt(value, 10);
    } else {
      frontmatter[key] = value.replace(/^"|"$/g, "");
    }
  }
  return { frontmatter, body };
}

function serializeFrontmatter(frontmatter, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${String(value)}"`);
    }
  }
  lines.push("---", "");
  return `${lines.join("\n")}${body}`;
}

async function listMarkdownFiles(root) {
  const result = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result.push(full);
      }
    }
  }
  await walk(root);
  return result;
}

function getScriptEntryActions(projectType) {
  const common = [
    { id: "open-project-outline", label: "Open Project Outline" },
    { id: "new-episode", label: "Create Episode" },
    { id: "new-scene", label: "Create Scene Card" },
  ];
  if (projectType === "script-single") {
    return common.filter((item) => item.id !== "new-episode");
  }
  return common;
}

async function getEpisodeWorkspaceBindings(projectRoot, episodeName) {
  const ep = String(episodeName).trim().toUpperCase();
  const episodeRoot = join(projectRoot, "剧本", ep);
  const outlinePath = join(episodeRoot, "大纲.md");
  const scriptPath = join(episodeRoot, "剧本.md");
  const scenesRoot = join(episodeRoot, "场次");
  const orderPath = join(scenesRoot, ".scene-order.json");

  const ordered = await readFile(orderPath, "utf8")
    .then((raw) => JSON.parse(raw).map((item) => item.sceneName))
    .catch(async () => {
      const files = await readdir(scenesRoot).catch(() => []);
      return files
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.replace(/\.md$/i, ""))
        .sort();
    });

  return {
    episodeName: ep,
    outlinePath,
    scriptPath,
    scenesRoot,
    orderedScenes: ordered,
  };
}

async function insertAssetReferenceInScript(docPath, { assetId, label = "" }) {
  const raw = await readFile(docPath, "utf8").catch(() => "");
  const marker = `[[${assetId}]]`;
  if (raw.includes(marker)) {
    return { updated: false, docPath };
  }

  const section = "## Asset References";
  const line = `- ${marker}${label ? ` ${label}` : ""}`;
  const next = raw.includes(section) ? `${raw.trimEnd()}\n${line}\n` : `${raw.trimEnd()}\n\n${section}\n${line}\n`;
  await writeFile(docPath, next.trimStart(), "utf8");
  return { updated: true, docPath };
}

async function getAssetBacklinks(projectRoot, assetId) {
  const files = await listMarkdownFiles(projectRoot);
  const marker = `[[${assetId}]]`;
  const hits = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (raw.includes(marker)) {
      hits.push(file);
    }
  }
  return hits;
}

async function syncSceneOrderMetadata(projectRoot, episodeName, orderedSceneNames) {
  return reorderScenes(projectRoot, episodeName, orderedSceneNames);
}

async function saveScriptDocumentWithLock(
  docPath,
  { nextBody, expectedRev, updatedBy = "local-user", conflictIncomingContent = "" }
) {
  const raw = await readFile(docPath, "utf8").catch(() => "");
  const parsed = parseFrontmatter(raw);
  const currentRev = Number.isInteger(parsed.frontmatter.rev) ? parsed.frontmatter.rev : 1;

  if (expectedRev !== currentRev) {
    const conflictDir = join(dirname(docPath), ".conflicts");
    await mkdir(conflictDir, { recursive: true });
    const conflictPath = join(conflictDir, `${basename(docPath)}.conflict-${Date.now()}.md`);
    const conflictDoc = [
      "# Manual Merge Required",
      "",
      `- expected_rev: ${expectedRev}`,
      `- current_rev: ${currentRev}`,
      "",
      "## Current",
      parsed.body || "",
      "",
      "## Incoming",
      conflictIncomingContent || nextBody || "",
      "",
    ].join("\n");
    await writeFile(conflictPath, conflictDoc, "utf8");
    return {
      status: "conflict",
      currentRev,
      conflictPath,
    };
  }

  const frontmatter = {
    rev: currentRev + 1,
    updated_at: nowIso(),
    updated_by: updatedBy,
  };
  await writeFile(docPath, serializeFrontmatter(frontmatter, nextBody), "utf8");
  return {
    status: "saved",
    rev: currentRev + 1,
  };
}

export {
  getAssetBacklinks,
  getEpisodeWorkspaceBindings,
  getScriptEntryActions,
  insertAssetReferenceInScript,
  saveScriptDocumentWithLock,
  syncSceneOrderMetadata,
};
