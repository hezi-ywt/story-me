import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { runCli } from "../src/cli/main.js";

async function makeTmpDir(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

async function invokeCli(argv) {
  let stdout = "";
  let stderr = "";
  const result = await runCli(argv, {
    writeStdout: (text) => {
      stdout += text;
    },
    writeStderr: (text) => {
      stderr += text;
    },
  });
  return {
    ...result,
    stdout,
    stderr,
  };
}

function parseJsonOutput(raw) {
  return JSON.parse(raw.trim());
}

test("cli supports init and add-episode workflow", async () => {
  const dir = await makeTmpDir("story-me-cli-init-");
  try {
    const init = await invokeCli(["init", "--path", dir, "--type", "script-series", "--json"]);
    assert.equal(init.exitCode, 0);
    const initPayload = parseJsonOutput(init.stdout);
    assert.equal(initPayload.ok, true);
    assert.equal(initPayload.command, "init");
    await stat(join(dir, "资产"));
    await stat(join(dir, "剧本", "大纲.md"));

    const addEpisode = await invokeCli(["add-episode", "--path", dir, "--episode", "1"]);
    assert.equal(addEpisode.exitCode, 0);
    assert.match(addEpisode.stdout, /\[ok\] add-episode/);
    await stat(join(dir, "剧本", "EP01", "大纲.md"));
    await stat(join(dir, "剧本", "EP01", "剧本.md"));
    await stat(join(dir, "剧本", "EP01", "场次"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cli supports new-asset and search workflow", async () => {
  const dir = await makeTmpDir("story-me-cli-asset-search-");
  try {
    await invokeCli(["init", "--path", dir, "--type", "script-series", "--json"]);

    const created = await invokeCli([
      "new-asset",
      "--path",
      dir,
      "--type",
      "角色",
      "--name",
      "林月",
      "--description",
      "主角",
      "--image",
      "linyue.png",
      "--json",
    ]);
    assert.equal(created.exitCode, 0);
    const createdPayload = parseJsonOutput(created.stdout);
    await stat(createdPayload.result.assetDocPath);

    const searched = await invokeCli([
      "search",
      "--path",
      dir,
      "--query",
      "林月",
      "--type",
      "asset",
      "--json",
    ]);
    assert.equal(searched.exitCode, 0);
    const searchPayload = parseJsonOutput(searched.stdout);
    assert.equal(searchPayload.ok, true);
    assert.equal(searchPayload.command, "search");
    assert.ok(searchPayload.result.count >= 1);
    assert.ok(
      searchPayload.result.results.some((item) => item.path === createdPayload.result.assetDocPath),
      "expected search results to include created asset document"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cli ingest handles copy conflicts and move mode", async () => {
  const dir = await makeTmpDir("story-me-cli-ingest-");
  try {
    await invokeCli(["init", "--path", dir, "--json"]);

    const sourceA = join(dir, "source-a");
    const sourceB = join(dir, "source-b");
    const duplicateA = join(sourceA, "photo.png");
    const duplicateB = join(sourceB, "photo.png");
    await mkdir(sourceA, { recursive: true });
    await mkdir(sourceB, { recursive: true });
    await writeFile(duplicateA, "image-a", "utf8");
    await writeFile(duplicateB, "image-b", "utf8");

    const copyResult = await invokeCli([
      "ingest",
      "--path",
      dir,
      "--target",
      "角色",
      "--input",
      duplicateA,
      "--input",
      duplicateB,
      "--json",
    ]);
    assert.equal(copyResult.exitCode, 0);
    const copyPayload = parseJsonOutput(copyResult.stdout);
    assert.equal(copyPayload.ok, true);
    assert.equal(copyPayload.result.summary.completed, 2);
    const names = copyPayload.result.results
      .filter((item) => item.status === "success")
      .map((item) => basename(item.destinationPath))
      .sort();
    assert.deepEqual(names, ["photo-2.png", "photo.png"]);
    await stat(duplicateA);
    await stat(duplicateB);

    const moveSource = join(dir, "movable.mp3");
    await writeFile(moveSource, "audio", "utf8");

    const moveResult = await invokeCli([
      "ingest",
      "--path",
      dir,
      "--target",
      "道具",
      "--mode",
      "move",
      "--input",
      moveSource,
      "--json",
    ]);
    assert.equal(moveResult.exitCode, 0);
    const movePayload = parseJsonOutput(moveResult.stdout);
    assert.equal(movePayload.result.summary.completed, 1);
    const moved = movePayload.result.results.find((item) => item.status === "success");
    await assert.rejects(() => stat(moveSource));
    await stat(moved.destinationPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cli returns deterministic validation and runtime exit codes", async () => {
  const unknown = await invokeCli(["unknown-command", "--json"]);
  assert.equal(unknown.exitCode, 2);
  const unknownPayload = parseJsonOutput(unknown.stderr);
  assert.equal(unknownPayload.ok, false);
  assert.equal(unknownPayload.error.code, "VALIDATION_ERROR");
  assert.match(unknownPayload.error.message, /Unknown command/);

  const missingArg = await invokeCli(["add-episode", "--json"]);
  assert.equal(missingArg.exitCode, 2);
  const missingPayload = parseJsonOutput(missingArg.stderr);
  assert.equal(missingPayload.error.code, "VALIDATION_ERROR");
  assert.match(missingPayload.error.message, /Missing required argument: --path/);
  assert.match(missingPayload.error.details.usage, /add-episode/);

  const dir = await makeTmpDir("story-me-cli-runtime-");
  try {
    const occupiedPath = join(dir, "occupied.txt");
    await writeFile(occupiedPath, "busy", "utf8");
    const runtime = await invokeCli(["init", "--path", occupiedPath, "--json"]);
    assert.equal(runtime.exitCode, 1);
    const runtimePayload = parseJsonOutput(runtime.stderr);
    assert.equal(runtimePayload.error.code, "RUNTIME_ERROR");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
