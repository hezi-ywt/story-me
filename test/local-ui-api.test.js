import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { dispatchApi } from "../src/ui-server/routes.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

function makeRequest(method, body) {
  const raw = body ? JSON.stringify(body) : "";
  const request = Readable.from(raw ? [Buffer.from(raw)] : []);
  request.method = method;
  request.headers = {
    "content-type": "application/json",
  };
  return request;
}

async function requestJson(path, { method = "GET", body } = {}) {
  const request = makeRequest(method, body);
  const url = new URL(path, "http://storyme.local");

  try {
    const result = await dispatchApi(request, url);
    return {
      status: 200,
      payload: {
        ok: true,
        result,
      },
    };
  } catch (error) {
    return {
      status: error?.statusCode ?? 500,
      payload: {
        ok: false,
        error: {
          code: error?.code ?? "RUNTIME_ERROR",
          message: error?.message ?? String(error),
          details: error?.details ?? null,
        },
      },
    };
  }
}

test("local ui api supports init, create, search, save and upload ingest flows", async () => {
  const dir = await makeTmpDir("story-me-ui-api-");

  try {
    const init = await requestJson("/api/project/init", {
      method: "POST",
      body: {
        projectRoot: dir,
        type: "script-series",
      },
    });
    assert.equal(init.status, 200);
    assert.equal(init.payload.ok, true);
    await stat(join(dir, "剧本", "大纲.md"));

    const tree = await requestJson(`/api/workspace/tree?projectRoot=${encodeURIComponent(dir)}&advancedMode=0`);
    assert.equal(tree.status, 200);
    assert.ok(Array.isArray(tree.payload.result.tree.nodes));
    assert.equal(tree.payload.result.tree.nodes.length, 2);

    const ep = await requestJson("/api/workspace/episode", {
      method: "POST",
      body: {
        projectRoot: dir,
        episode: "1",
      },
    });
    assert.equal(ep.status, 200);
    await stat(join(dir, "剧本", "EP01", "剧本.md"));

    const asset = await requestJson("/api/workspace/asset", {
      method: "POST",
      body: {
        projectRoot: dir,
        assetType: "角色",
        name: "林月",
        description: "主角",
        image: "linyue.png",
      },
    });
    assert.equal(asset.status, 200);
    const assetDocPath = asset.payload.result.assetDocPath;
    await stat(assetDocPath);

    const search = await requestJson(
      `/api/workspace/search?projectRoot=${encodeURIComponent(dir)}&query=${encodeURIComponent("林月")}&type=asset`
    );
    assert.equal(search.status, 200);
    assert.ok(search.payload.result.count >= 1);
    assert.ok(search.payload.result.results.some((item) => item.path === assetDocPath));

    const readDoc = await requestJson(`/api/document?path=${encodeURIComponent(assetDocPath)}`);
    assert.equal(readDoc.status, 200);
    assert.match(readDoc.payload.result.content, /asset_id:/);

    const saveDoc = await requestJson("/api/document/save", {
      method: "POST",
      body: {
        path: assetDocPath,
        content: `${readDoc.payload.result.content}\n# saved\n`,
      },
    });
    assert.equal(saveDoc.status, 200);
    const afterSave = await readFile(assetDocPath, "utf8");
    assert.match(afterSave, /# saved/);

    const docIngest = await requestJson("/api/document/ingest", {
      method: "POST",
      body: {
        projectRoot: dir,
        docPath: assetDocPath,
        files: [
          {
            name: "hero.png",
            base64: Buffer.from("fake-image-data").toString("base64"),
          },
          {
            name: "voice.mp3",
            base64: Buffer.from("fake-audio-data").toString("base64"),
          },
          {
            name: "clip.mp4",
            base64: Buffer.from("fake-video-data").toString("base64"),
          },
          {
            name: "notes.txt",
            base64: Buffer.from("scene notes").toString("base64"),
          },
        ],
      },
    });
    assert.equal(docIngest.status, 200);
    assert.equal(docIngest.payload.result.summary.completed, 4);
    assert.match(docIngest.payload.result.content, /## 媒体资源/);
    assert.match(docIngest.payload.result.content, /!\[/);
    assert.match(docIngest.payload.result.content, /<audio controls/);
    assert.match(docIngest.payload.result.content, /<video controls/);
    assert.match(docIngest.payload.result.content, /\[📄 /);
    for (const item of docIngest.payload.result.results) {
      if (item.status !== "success") {
        continue;
      }
      await stat(item.destinationPath);
      await stat(`${item.destinationPath}.meta.json`);
      assert.match(item.destinationPath, /媒体[\\/](images|audio|videos|files)[\\/]/);
    }

    const afterIngest = await readFile(assetDocPath, "utf8");
    assert.match(afterIngest, /## 媒体资源/);

    const ingest = await requestJson("/api/workspace/ingest-upload", {
      method: "POST",
      body: {
        projectRoot: dir,
        target: { nodeType: "角色" },
        mode: "copy",
        files: [
          {
            name: "hero.png",
            base64: Buffer.from("fake-image-data").toString("base64"),
          },
        ],
      },
    });
    assert.equal(ingest.status, 200);
    assert.equal(ingest.payload.result.summary.completed, 1);
    const success = ingest.payload.result.results.find((item) => item.status === "success");
    await stat(success.destinationPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("local ui api returns validation errors with deterministic envelope", async () => {
  const missing = await requestJson("/api/project/init", {
    method: "POST",
    body: {
      type: "script-single",
    },
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.payload.ok, false);
  assert.equal(missing.payload.error.code, "VALIDATION_ERROR");
  assert.match(missing.payload.error.message, /projectRoot/i);

  const unknown = await requestJson("/api/nope");
  assert.equal(unknown.status, 404);
  assert.equal(unknown.payload.ok, false);
  assert.equal(unknown.payload.error.code, "NOT_FOUND");
});
