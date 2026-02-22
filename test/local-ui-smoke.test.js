import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

test("local workspace ui serves tri-pane shell and static assets", async () => {
  const indexPath = resolve("src/ui/index.html");
  const appPath = resolve("src/ui/app.js");
  const cssPath = resolve("src/ui/styles.css");

  await stat(indexPath);
  await stat(appPath);
  await stat(cssPath);

  const index = await readFile(indexPath, "utf8");
  assert.match(index, /Story Me Workspace/);
  assert.match(index, /id="tree-root"/);
  assert.match(index, /id="editor-textarea"/);
  assert.match(index, /id="editor-drop-overlay"/);
  assert.match(index, /id="preview-content"/);

  const app = await readFile(appPath, "utf8");
  assert.match(app, /bootstrap\(\)/);
  assert.match(app, /loadTree/);
  assert.match(app, /handleDrop/);
  assert.match(app, /handleEditorDrop/);
  assert.match(app, /\/api\/document\/ingest/);

  const css = await readFile(cssPath, "utf8");
  assert.match(css, /--bg:/);
  assert.match(css, /\.workspace-grid/);
  assert.match(css, /\.preview-card/);
  assert.match(css, /\.editor-drop-overlay/);
});
