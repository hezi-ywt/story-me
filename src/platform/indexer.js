import { extname } from "node:path";

function inferDocType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) {
    if (lower.includes("/资产/")) {
      return "asset-doc";
    }
    if (lower.includes("/剧本/")) {
      return "script-doc";
    }
    return "doc";
  }

  const ext = extname(lower);
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    return "image";
  }
  if ([".mp4", ".mov", ".webm"].includes(ext)) {
    return "video";
  }
  if ([".mp3", ".wav", ".m4a"].includes(ext)) {
    return "audio";
  }
  return "file";
}

class IncrementalIndexer {
  constructor(adapter) {
    this.adapter = adapter;
    this.entries = new Map();
    this.unwatch = null;
  }

  async buildInitialIndex(root) {
    const files = await this.adapter.listEntries(root, { recursive: true, includeDirectories: false });
    this.entries.clear();
    for (const item of files) {
      this.entries.set(item.path, {
        path: item.path,
        type: inferDocType(item.path),
      });
    }
    return this.snapshot();
  }

  applyFsEvent(event) {
    const path = event.path;
    if (!path) {
      return;
    }
    if (event.eventType === "rename" && event.removed) {
      this.entries.delete(path);
      return;
    }
    this.entries.set(path, {
      path,
      type: inferDocType(path),
    });
  }

  watch(root) {
    if (this.unwatch) {
      this.unwatch();
    }
    this.unwatch = this.adapter.watchPath(root, (event) => this.applyFsEvent(event));
    return () => {
      if (this.unwatch) {
        this.unwatch();
        this.unwatch = null;
      }
    };
  }

  snapshot() {
    return {
      total: this.entries.size,
      byType: [...this.entries.values()].reduce((acc, item) => {
        acc[item.type] = (acc[item.type] ?? 0) + 1;
        return acc;
      }, {}),
      entries: [...this.entries.values()],
    };
  }
}

export { IncrementalIndexer, inferDocType };
