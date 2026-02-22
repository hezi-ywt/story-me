import { stat, readdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { extname, join } from "node:path";

import { PlatformAdapter } from "./platform-adapter.js";

function mediaType(path) {
  const ext = extname(path).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    return "image";
  }
  if ([".mp4", ".mov", ".webm"].includes(ext)) {
    return "video";
  }
  if ([".mp3", ".wav", ".m4a"].includes(ext)) {
    return "audio";
  }
  return "other";
}

class DesktopPlatformAdapter extends PlatformAdapter {
  async readText(path) {
    return readFile(path, "utf8");
  }

  async writeText(path, content) {
    await writeFile(path, content, "utf8");
  }

  async listEntries(root, options = {}) {
    const recursive = options.recursive ?? true;
    const includeDirectories = options.includeDirectories ?? false;
    const out = [];

    async function walk(dir) {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (includeDirectories) {
            out.push({ path: full, kind: "dir" });
          }
          if (recursive) {
            await walk(full);
          }
        } else if (entry.isFile()) {
          out.push({ path: full, kind: "file" });
        }
      }
    }

    await walk(root);
    return out;
  }

  watchPath(root, onEvent) {
    let watcher;
    const handler = (eventType, filename) => {
      onEvent({
        eventType,
        filename,
        path: filename ? join(root, filename) : root,
      });
    };
    try {
      watcher = watch(root, { recursive: true }, handler);
    } catch {
      watcher = watch(root, { recursive: false }, handler);
    }
    return () => watcher.close();
  }

  async probeMedia(path) {
    const info = await stat(path);
    return {
      path,
      size: info.size,
      mtime: info.mtime.toISOString(),
      mediaType: mediaType(path),
    };
  }
}

export { DesktopPlatformAdapter };
