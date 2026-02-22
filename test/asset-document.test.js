import test from "node:test";
import assert from "node:assert/strict";

import {
  createAssetDocument,
  parseAssetDocument,
  updateAssetRevision,
  validateAndMigrateMetadata,
} from "../src/core/asset-document.js";

test("creates base asset document with required managed metadata", () => {
  const markdown = createAssetDocument(
    {
      type: "character",
      name: "林月",
      description: "主角，内向但坚韧。",
      image: "lin-yue.png",
    },
    {
      now: "2026-02-22T01:00:00.000Z",
      idFactory: () => "asset-001",
      updatedBy: "local-user",
    }
  );

  const parsed = parseAssetDocument(markdown);
  assert.equal(parsed.metadata.schema_version, 1);
  assert.equal(parsed.metadata.asset_id, "asset-001");
  assert.equal(parsed.metadata.type, "character");
  assert.equal(parsed.metadata.rev, 1);
  assert.equal(parsed.fields.name, "林月");
  assert.equal(parsed.fields.image, "lin-yue.png");
  assert.equal(parsed.fields.description, "主角，内向但坚韧。");
});

test("supports custom field round-trip", () => {
  const markdown = createAssetDocument(
    {
      type: "prop",
      name: "古剑",
      description: "关键道具。",
      image: "sword.png",
      customFields: {
        rarity: "legendary",
        owner: "林月",
      },
    },
    {
      now: "2026-02-22T01:00:00.000Z",
      idFactory: () => "asset-002",
    }
  );

  const parsed = parseAssetDocument(markdown);
  assert.deepEqual(parsed.fields.customFields, {
    rarity: "legendary",
    owner: "林月",
  });
});

test("increments revision and updates timestamps on save", () => {
  const original = createAssetDocument(
    {
      type: "scene",
      name: "茶馆",
      description: "角色首次相遇。",
      image: "teahouse.png",
    },
    {
      now: "2026-02-22T01:00:00.000Z",
      idFactory: () => "asset-003",
      updatedBy: "writer-a",
    }
  );

  const revised = updateAssetRevision(original, {
    now: "2026-02-22T02:00:00.000Z",
    updatedBy: "writer-b",
  });
  const parsed = parseAssetDocument(revised);

  assert.equal(parsed.metadata.rev, 2);
  assert.equal(parsed.metadata.updated_by, "writer-b");
  assert.equal(parsed.metadata.updated_at, "2026-02-22T02:00:00.000Z");
});

test("migrates missing legacy metadata", () => {
  const migration = validateAndMigrateMetadata(
    {
      type: "character",
    },
    {
      now: "2026-02-22T01:00:00.000Z",
      idFactory: () => "asset-004",
      updatedBy: "local-user",
    }
  );

  assert.equal(migration.valid, true);
  assert.equal(migration.metadata.asset_id, "asset-004");
  assert.equal(migration.metadata.rev, 1);
  assert.equal(migration.metadata.schema_version, 1);
  assert.ok(migration.migratedFields.includes("updated_at"));
  assert.ok(migration.migratedFields.includes("updated_by"));
});
