const PROJECT_TYPES = Object.freeze({
  SCRIPT_SINGLE: "script-single",
  SCRIPT_SERIES: "script-series",
});

const TOP_LEVEL_DIRS = Object.freeze(["资产", "剧本"]);

const OUTLINE_FILENAME = "大纲.md";
const SCRIPT_FILENAME = "剧本.md";
const SCENES_DIRNAME = "场次";

function getProjectTemplate(type) {
  if (type !== PROJECT_TYPES.SCRIPT_SINGLE && type !== PROJECT_TYPES.SCRIPT_SERIES) {
    throw new Error(`Unsupported project type: ${type}`);
  }

  return {
    type,
    topLevelDirs: [...TOP_LEVEL_DIRS],
    requiredFiles: [`剧本/${OUTLINE_FILENAME}`],
    supportsEpisodes: type === PROJECT_TYPES.SCRIPT_SERIES,
  };
}

function normalizeEpisodeName(input) {
  const raw = String(input).trim().toUpperCase();
  const match = /^EP(\d+)$/.exec(raw);
  if (match) {
    return `EP${match[1].padStart(2, "0")}`;
  }

  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `EP${String(numeric).padStart(2, "0")}`;
  }

  throw new Error(`Invalid episode name: ${input}`);
}

export {
  OUTLINE_FILENAME,
  PROJECT_TYPES,
  SCENES_DIRNAME,
  SCRIPT_FILENAME,
  TOP_LEVEL_DIRS,
  getProjectTemplate,
  normalizeEpisodeName,
};
