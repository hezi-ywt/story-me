import { randomUUID } from "node:crypto";

const SCHEMA_VERSION = 1;

const REQUIRED_METADATA_FIELDS = Object.freeze([
  "schema_version",
  "asset_id",
  "type",
  "updated_at",
  "updated_by",
  "rev",
]);

function toIso(value) {
  return new Date(value ?? Date.now()).toISOString();
}

function parseScalar(value) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  if (
    raw.startsWith("{") ||
    raw.startsWith("[") ||
    raw.startsWith("\"") ||
    raw === "true" ||
    raw === "false" ||
    raw === "null" ||
    /^-?\d+(\.\d+)?$/.test(raw)
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through to raw string.
    }
  }

  return raw;
}

function serializeScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "\"\"";
  }

  return JSON.stringify(value);
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const markerIndex = markdown.indexOf("\n---\n", 4);
  if (markerIndex < 0) {
    return { frontmatter: {}, body: markdown };
  }

  const header = markdown.slice(4, markerIndex);
  const body = markdown.slice(markerIndex + 5);
  const frontmatter = {};

  for (const line of header.split("\n")) {
    if (!line.trim()) {
      continue;
    }

    const delimiter = line.indexOf(":");
    if (delimiter < 0) {
      continue;
    }

    const key = line.slice(0, delimiter).trim();
    const value = line.slice(delimiter + 1);
    frontmatter[key] = parseScalar(value);
  }

  return { frontmatter, body };
}

function serializeFrontmatter(frontmatter) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${serializeScalar(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function extractDescription(body) {
  const marker = "## Description\n";
  const idx = body.indexOf(marker);
  if (idx < 0) {
    return body.trim();
  }

  return body.slice(idx + marker.length).trim();
}

function validateMetadata(metadata) {
  const errors = [];
  for (const key of REQUIRED_METADATA_FIELDS) {
    if (metadata[key] === undefined || metadata[key] === null || metadata[key] === "") {
      errors.push(`Missing required metadata field: ${key}`);
    }
  }

  if (!Number.isInteger(metadata.schema_version) || metadata.schema_version < 1) {
    errors.push("schema_version MUST be an integer >= 1");
  }
  if (!Number.isInteger(metadata.rev) || metadata.rev < 1) {
    errors.push("rev MUST be an integer >= 1");
  }
  if (typeof metadata.type !== "string" || !metadata.type.trim()) {
    errors.push("type MUST be a non-empty string");
  }
  if (typeof metadata.asset_id !== "string" || !metadata.asset_id.trim()) {
    errors.push("asset_id MUST be a non-empty string");
  }
  if (typeof metadata.updated_by !== "string" || !metadata.updated_by.trim()) {
    errors.push("updated_by MUST be a non-empty string");
  }
  if (Number.isNaN(Date.parse(metadata.updated_at))) {
    errors.push("updated_at MUST be a valid ISO date-time");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateAndMigrateMetadata(metadata = {}, options = {}) {
  const migrated = { ...metadata };
  const migratedFields = [];
  const now = options.now ?? Date.now();
  const idFactory = options.idFactory ?? randomUUID;

  if (!Number.isInteger(migrated.schema_version)) {
    migrated.schema_version = SCHEMA_VERSION;
    migratedFields.push("schema_version");
  }
  if (!migrated.asset_id) {
    migrated.asset_id = idFactory();
    migratedFields.push("asset_id");
  }
  if (!migrated.type) {
    migrated.type = options.type ?? "asset";
    migratedFields.push("type");
  }
  if (!migrated.updated_at || Number.isNaN(Date.parse(migrated.updated_at))) {
    migrated.updated_at = toIso(now);
    migratedFields.push("updated_at");
  }
  if (!migrated.updated_by) {
    migrated.updated_by = options.updatedBy ?? "local-user";
    migratedFields.push("updated_by");
  }
  if (!Number.isInteger(migrated.rev) || migrated.rev < 1) {
    migrated.rev = 1;
    migratedFields.push("rev");
  }

  const validation = validateMetadata(migrated);
  return {
    metadata: migrated,
    migratedFields,
    valid: validation.valid,
    errors: validation.errors,
  };
}

function createAssetDocument(input, options = {}) {
  const {
    type,
    name = "",
    description = "",
    image = "",
    customFields = {},
    metadata = {},
  } = input;

  const migration = validateAndMigrateMetadata(metadata, {
    type,
    updatedBy: options.updatedBy,
    now: options.now,
    idFactory: options.idFactory,
  });

  if (!migration.valid) {
    throw new Error(migration.errors.join("; "));
  }

  const frontmatter = {
    ...migration.metadata,
    name,
    image,
    custom_fields: customFields,
  };

  const body = `## Description\n${description}\n`;
  return `${serializeFrontmatter(frontmatter)}${body}`;
}

function parseAssetDocument(markdown) {
  const { frontmatter, body } = parseFrontmatter(markdown);
  const { custom_fields: customFields = {}, ...metadataAndBase } = frontmatter;
  const metadata = {};

  for (const field of REQUIRED_METADATA_FIELDS) {
    metadata[field] = metadataAndBase[field];
  }

  const fields = {
    name: metadataAndBase.name ?? "",
    image: metadataAndBase.image ?? "",
    description: extractDescription(body),
    customFields,
  };

  return {
    metadata,
    fields,
    rawFrontmatter: frontmatter,
  };
}

function updateAssetRevision(markdown, options = {}) {
  const parsed = parseAssetDocument(markdown);
  const migration = validateAndMigrateMetadata(parsed.metadata, {
    type: parsed.metadata.type,
    updatedBy: options.updatedBy,
    now: options.now,
    idFactory: options.idFactory,
  });

  const nextMetadata = {
    ...migration.metadata,
    rev: migration.metadata.rev + 1,
    updated_at: toIso(options.now),
    updated_by: options.updatedBy ?? migration.metadata.updated_by,
  };

  return createAssetDocument(
    {
      type: nextMetadata.type,
      name: parsed.fields.name,
      description: parsed.fields.description,
      image: parsed.fields.image,
      customFields: parsed.fields.customFields,
      metadata: nextMetadata,
    },
    {
      updatedBy: nextMetadata.updated_by,
      now: options.now,
      idFactory: options.idFactory,
    }
  );
}

export {
  REQUIRED_METADATA_FIELDS,
  SCHEMA_VERSION,
  createAssetDocument,
  parseAssetDocument,
  updateAssetRevision,
  validateAndMigrateMetadata,
  validateMetadata,
};
