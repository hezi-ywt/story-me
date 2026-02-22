import { resolve } from "node:path";

import { PROJECT_TYPES } from "../core/project-layout.js";
import { IngestService } from "../services/ingest-service.js";
import { createEpisode, createProjectScaffold } from "../services/project-service.js";
import { createAssetFlow, searchWorkspace } from "../services/workspace-explorer-service.js";
import { getFlag, getFlagList } from "./args.js";
import { validationError } from "./errors.js";
import { getUsageHint, listSupportedCommands } from "./help.js";

const ALLOWED_PROJECT_TYPES = new Set(Object.values(PROJECT_TYPES));
const ALLOWED_ASSET_TYPES = new Set(["角色", "道具", "场景", "character", "prop", "scene"]);
const ALLOWED_SEARCH_TYPES = new Set(["asset", "script", "doc"]);
const ALLOWED_INGEST_MODES = new Set(["copy", "move"]);
const EPISODE_TARGET_ALIASES = new Set(["ep", "episode"]);
const SCENE_TARGET_ALIASES = new Set(["场次", "scene-card", "scenecard", "scene_card"]);

function normalizedString(value) {
  if (value === undefined || value === null || value === true) {
    return "";
  }
  if (Array.isArray(value)) {
    return normalizedString(value[value.length - 1]);
  }
  return String(value).trim();
}

function readOptionalFlag(flags, names) {
  return normalizedString(getFlag(flags, ...names));
}

function missingArgument(command, flag) {
  return validationError(`Missing required argument: ${flag}`, {
    command,
    missing: flag,
    usage: getUsageHint(command),
  });
}

function readRequiredFlag(flags, command, names, flagLabel) {
  const value = readOptionalFlag(flags, names);
  if (!value) {
    throw missingArgument(command, flagLabel);
  }
  return value;
}

function resolveProjectRoot(flags, command) {
  const raw = readRequiredFlag(flags, command, ["path", "p"], "--path");
  return resolve(raw);
}

function parseProjectType(flags) {
  const projectType = readOptionalFlag(flags, ["type", "t"]) || PROJECT_TYPES.SCRIPT_SINGLE;
  if (!ALLOWED_PROJECT_TYPES.has(projectType)) {
    throw validationError(`Unsupported project type: ${projectType}`, {
      allowed: [...ALLOWED_PROJECT_TYPES],
      usage: getUsageHint("init"),
    });
  }
  return projectType;
}

function parseAssetType(flags) {
  const assetType = readRequiredFlag(flags, "new-asset", ["type", "t"], "--type");
  if (ALLOWED_ASSET_TYPES.has(assetType) || ALLOWED_ASSET_TYPES.has(assetType.toLowerCase())) {
    return assetType;
  }

  throw validationError(`Unsupported asset type: ${assetType}`, {
    allowed: [...ALLOWED_ASSET_TYPES],
    usage: getUsageHint("new-asset"),
  });
}

function parseSearchType(flags) {
  const type = readOptionalFlag(flags, ["type", "t"]).toLowerCase();
  if (!type) {
    return "";
  }
  if (!ALLOWED_SEARCH_TYPES.has(type)) {
    throw validationError(`Unsupported search type: ${type}`, {
      allowed: [...ALLOWED_SEARCH_TYPES],
      usage: getUsageHint("search"),
    });
  }
  return type;
}

function parseIngestMode(flags) {
  const mode = (readOptionalFlag(flags, ["mode", "m"]) || "copy").toLowerCase();
  if (!ALLOWED_INGEST_MODES.has(mode)) {
    throw validationError(`Unsupported ingest mode: ${mode}`, {
      allowed: [...ALLOWED_INGEST_MODES],
      usage: getUsageHint("ingest"),
    });
  }
  return mode;
}

function parseIngestTarget(flags) {
  const rawTarget = readRequiredFlag(flags, "ingest", ["target", "t"], "--target");
  const lower = rawTarget.toLowerCase();
  const target = { nodeType: rawTarget };

  if (EPISODE_TARGET_ALIASES.has(lower) || rawTarget === "EP") {
    target.nodeType = "EP";
    target.episodeName = readRequiredFlag(flags, "ingest", ["episode", "e"], "--episode");
  }

  if (SCENE_TARGET_ALIASES.has(lower)) {
    target.nodeType = "场次";
    target.episodeName = readRequiredFlag(flags, "ingest", ["episode", "e"], "--episode");
    target.sceneName = readRequiredFlag(flags, "ingest", ["scene", "s", "scene-name"], "--scene");
  }

  return target;
}

function parseIngestInputs(flags, positionals) {
  const fromFlags = getFlagList(flags, "input", "i")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const fromPositionals = positionals.map((value) => String(value).trim()).filter(Boolean);
  const inputs = (fromFlags.length > 0 ? fromFlags : fromPositionals).map((value) => resolve(value));

  if (inputs.length === 0) {
    throw missingArgument("ingest", "--input");
  }

  return inputs;
}

function parseEpisodeInput(flags, positionals) {
  const fromFlag = readOptionalFlag(flags, ["episode", "e"]);
  if (fromFlag) {
    return fromFlag;
  }
  const fallback = positionals.find((item) => String(item).trim());
  if (fallback) {
    return String(fallback).trim();
  }
  throw missingArgument("add-episode", "--episode");
}

async function runInit({ flags }) {
  const projectRoot = resolveProjectRoot(flags, "init");
  const type = parseProjectType(flags);
  return createProjectScaffold(projectRoot, type);
}

async function runAddEpisode({ flags, positionals }) {
  const projectRoot = resolveProjectRoot(flags, "add-episode");
  const episodeInput = parseEpisodeInput(flags, positionals);
  return createEpisode(projectRoot, episodeInput);
}

async function runNewAsset({ flags }) {
  const projectRoot = resolveProjectRoot(flags, "new-asset");
  const assetType = parseAssetType(flags);
  const name = readRequiredFlag(flags, "new-asset", ["name", "n"], "--name");
  const description = readOptionalFlag(flags, ["description", "d"]);
  const image = readOptionalFlag(flags, ["image", "i"]);

  return createAssetFlow(projectRoot, {
    assetType,
    name,
    description,
    image,
  });
}

async function runIngest({ flags, positionals }) {
  const projectRoot = resolveProjectRoot(flags, "ingest");
  const mode = parseIngestMode(flags);
  const target = parseIngestTarget(flags);
  const inputs = parseIngestInputs(flags, positionals);
  const contextDocPath = readOptionalFlag(flags, ["context-doc"]);
  const ingestService = new IngestService();

  return ingestService.ingestBatch({
    projectRoot,
    target,
    inputs,
    mode,
    contextDocPath: contextDocPath ? resolve(contextDocPath) : null,
  });
}

async function runSearch({ flags, positionals }) {
  const projectRoot = resolveProjectRoot(flags, "search");
  const query = readOptionalFlag(flags, ["query", "q"]) || positionals.join(" ").trim();
  const type = parseSearchType(flags);
  const tag = readOptionalFlag(flags, ["tag"]);
  const results = await searchWorkspace(projectRoot, { query, type, tag });

  const sorted = [...results].sort((left, right) => left.path.localeCompare(right.path));
  return {
    count: sorted.length,
    results: sorted,
  };
}

const COMMAND_HANDLERS = Object.freeze({
  init: runInit,
  "add-episode": runAddEpisode,
  "new-asset": runNewAsset,
  ingest: runIngest,
  search: runSearch,
});

async function executeCommand({ command, flags, positionals }) {
  if (!command) {
    throw validationError("Missing command.", { usage: "storyme --help" });
  }

  const handler = COMMAND_HANDLERS[command];
  if (!handler) {
    throw validationError(`Unknown command: ${command}`, {
      command,
      usage: "storyme --help",
      supported: listSupportedCommands(),
    });
  }

  const result = await handler({ flags, positionals });
  return { command, result };
}

export { executeCommand };
