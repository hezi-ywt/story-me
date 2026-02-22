import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const LINKED_ASSETS_HEADER = "## Linked Assets";

function appendLinkedAsset(content, { assetId, relativePath }) {
  const marker = `[[${assetId}]]`;
  if (content.includes(marker)) {
    return content;
  }

  const linkLine = `- ${marker} ${relativePath}`.trimEnd();
  const trimmed = content.replace(/\s+$/, "");

  if (!trimmed.includes(LINKED_ASSETS_HEADER)) {
    if (!trimmed) {
      return `${LINKED_ASSETS_HEADER}\n${linkLine}\n`;
    }
    return `${trimmed}\n\n${LINKED_ASSETS_HEADER}\n${linkLine}\n`;
  }

  const sectionStart = trimmed.indexOf(LINKED_ASSETS_HEADER);
  const head = trimmed.slice(0, sectionStart + LINKED_ASSETS_HEADER.length);
  const tail = trimmed.slice(sectionStart + LINKED_ASSETS_HEADER.length).replace(/^\n*/, "");
  return `${head}\n${tail ? `${tail}\n` : ""}${linkLine}\n`;
}

async function upsertLinkedAsset(sceneDocPath, linkInfo) {
  let previous = "";
  let existed = true;
  try {
    previous = await readFile(sceneDocPath, "utf8");
  } catch {
    existed = false;
  }

  const next = appendLinkedAsset(previous, linkInfo);
  await mkdir(dirname(sceneDocPath), { recursive: true });
  await writeFile(sceneDocPath, next, "utf8");
  return { previous, existed, next };
}

async function restoreDocumentBackup(backup) {
  if (backup.existed) {
    await writeFile(backup.path, backup.previous, "utf8");
    return;
  }
  await rm(backup.path, { force: true });
}

export { LINKED_ASSETS_HEADER, appendLinkedAsset, restoreDocumentBackup, upsertLinkedAsset };
