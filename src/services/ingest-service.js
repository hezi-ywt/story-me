import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";

import { makeDeterministicUniqueFilename, sanitizePathSegment } from "../core/path-utils.js";
import { resolveIngestTarget } from "../core/ingest-routing.js";
import { restoreDocumentBackup, upsertLinkedAsset } from "../core/linking.js";

function classifyMediaType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mapping = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".mp4": "video",
    ".mov": "video",
    ".webm": "video",
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
  };
  return mapping[ext] ?? "other";
}

function mediaBucket(type) {
  const map = {
    image: "images",
    video: "videos",
    audio: "audio",
    other: "files",
  };
  return map[type] ?? "files";
}

async function ensureUniqueDestinationPath(targetDir, sourceName) {
  const entries = await readdir(targetDir).catch(() => []);
  const safeName = sanitizePathSegment(sourceName);
  const unique = makeDeterministicUniqueFilename(safeName, entries);
  return join(targetDir, unique);
}

async function movePath(source, destination) {
  try {
    await rename(source, destination);
    return;
  } catch (error) {
    if (error && error.code !== "EXDEV") {
      throw error;
    }
  }
  await cp(source, destination, { recursive: true, force: false, errorOnExist: true });
  await rm(source, { recursive: true, force: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

class IngestService {
  constructor(options = {}) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.lastTransaction = null;
  }

  async ingestBatch({
    projectRoot,
    target,
    inputs,
    mode = "copy",
    contextDocPath = null,
    onProgress = null,
  }) {
    if (!["copy", "move"].includes(mode)) {
      throw new Error(`Unsupported ingest mode: ${mode}`);
    }
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new Error("inputs must be a non-empty array.");
    }

    const resolvedTarget = resolveIngestTarget(projectRoot, target);
    const nodeBasePath = resolvedTarget.basePath;
    const linkDocPath = contextDocPath ?? resolvedTarget.sceneDocPath;

    await mkdir(nodeBasePath, { recursive: true });

    const results = [];
    const transaction = {
      id: this.idFactory(),
      copyDestinations: [],
      moveEntries: [],
      metadataPaths: [],
      documentBackups: new Map(),
    };

    let completed = 0;
    for (let index = 0; index < inputs.length; index += 1) {
      const sourcePath = inputs[index];
      try {
        const sourceStats = await stat(sourcePath);
        const sourceName = basename(sourcePath);
        const bucket = mediaBucket(classifyMediaType(sourcePath));
        const bucketDir = join(nodeBasePath, bucket);
        await mkdir(bucketDir, { recursive: true });
        const destinationPath = await ensureUniqueDestinationPath(bucketDir, sourceName);

        if (mode === "copy") {
          await cp(sourcePath, destinationPath, { recursive: sourceStats.isDirectory(), force: false });
          transaction.copyDestinations.push(destinationPath);
        } else {
          await mkdir(dirname(destinationPath), { recursive: true });
          await movePath(sourcePath, destinationPath);
          transaction.moveEntries.push({ sourcePath, destinationPath });
        }

        const assetId = this.idFactory();
        const metadataPath = `${destinationPath}.meta.json`;
        const metadata = {
          schema_version: 1,
          asset_id: assetId,
          media_type: classifyMediaType(destinationPath),
          source_path: sourcePath,
          stored_path: destinationPath,
          target_node: resolvedTarget.nodeType,
          target_logical_path: resolvedTarget.logicalPath,
          backlinks: [],
        };

        if (linkDocPath) {
          const linkRelative = relative(dirname(linkDocPath), destinationPath);
          const backupKey = linkDocPath;
          if (!transaction.documentBackups.has(backupKey)) {
            const backup = await upsertLinkedAsset(linkDocPath, {
              assetId,
              relativePath: linkRelative,
            });
            transaction.documentBackups.set(backupKey, {
              path: linkDocPath,
              previous: backup.previous,
              existed: backup.existed,
            });
          } else {
            await upsertLinkedAsset(linkDocPath, {
              assetId,
              relativePath: linkRelative,
            });
          }

          metadata.backlinks.push(relative(projectRoot, linkDocPath));
        }

        const existingMetadata = await readJson(metadataPath, {});
        const nextMetadata = { ...existingMetadata, ...metadata };
        await writeFile(metadataPath, JSON.stringify(nextMetadata, null, 2), "utf8");
        transaction.metadataPaths.push(metadataPath);

        completed += 1;
        results.push({
          sourcePath,
          status: "success",
          destinationPath,
          metadataPath,
          assetId,
        });
      } catch (error) {
        results.push({
          sourcePath,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (typeof onProgress === "function") {
        onProgress({
          processed: index + 1,
          total: inputs.length,
          completed,
          failed: index + 1 - completed,
        });
      }
    }

    this.lastTransaction = transaction;
    return {
      mode,
      target: resolvedTarget,
      summary: {
        total: inputs.length,
        completed,
        failed: inputs.length - completed,
      },
      results,
      transactionId: transaction.id,
    };
  }

  async undoLastImport() {
    if (!this.lastTransaction) {
      return { undone: false, reason: "no-transaction" };
    }

    const transaction = this.lastTransaction;

    for (const backup of [...transaction.documentBackups.values()].reverse()) {
      await restoreDocumentBackup(backup);
    }

    for (const metadataPath of [...transaction.metadataPaths].reverse()) {
      await rm(metadataPath, { force: true });
    }

    for (const entry of [...transaction.copyDestinations].reverse()) {
      await rm(entry, { recursive: true, force: true });
    }

    for (const entry of [...transaction.moveEntries].reverse()) {
      try {
        await mkdir(dirname(entry.sourcePath), { recursive: true });
        await movePath(entry.destinationPath, entry.sourcePath);
      } catch {
        // Best-effort restore; continue reverting remaining entries.
      }
    }

    this.lastTransaction = null;
    return {
      undone: true,
      transactionId: transaction.id,
      revertedCount:
        transaction.copyDestinations.length +
        transaction.moveEntries.length +
        transaction.metadataPaths.length +
        transaction.documentBackups.size,
    };
  }
}

export { IngestService };
