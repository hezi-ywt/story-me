import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  OUTLINE_FILENAME,
  SCENES_DIRNAME,
  SCRIPT_FILENAME,
  getProjectTemplate,
  normalizeEpisodeName,
} from "../core/project-layout.js";

function makeFrontmatter(type) {
  return [
    "---",
    "schema_version: 1",
    `type: ${type}`,
    "title: \"\"",
    "---",
    "",
  ].join("\n");
}

async function writeIfMissing(filePath, content) {
  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, content, "utf8");
  }
}

async function createProjectScaffold(projectRoot, type) {
  const template = getProjectTemplate(type);
  if (!String(projectRoot).trim()) {
    throw new Error("Project root is required.");
  }

  await mkdir(projectRoot, { recursive: true });
  for (const dir of template.topLevelDirs) {
    await mkdir(join(projectRoot, dir), { recursive: true });
  }

  await writeIfMissing(
    join(projectRoot, "剧本", OUTLINE_FILENAME),
    `${makeFrontmatter("project-outline")}# 大纲\n\n`
  );

  return {
    projectRoot,
    type,
    created: [
      ...template.topLevelDirs.map((dir) => join(projectRoot, dir)),
      join(projectRoot, "剧本", OUTLINE_FILENAME),
    ],
  };
}

async function createEpisode(projectRoot, episodeInput) {
  const episodeName = normalizeEpisodeName(episodeInput);
  const episodeDir = join(projectRoot, "剧本", episodeName);
  const scenesDir = join(episodeDir, SCENES_DIRNAME);

  await mkdir(scenesDir, { recursive: true });
  await writeIfMissing(
    join(episodeDir, OUTLINE_FILENAME),
    `${makeFrontmatter("episode-outline")}# ${episodeName} 大纲\n\n`
  );
  await writeIfMissing(
    join(episodeDir, SCRIPT_FILENAME),
    `${makeFrontmatter("episode-script")}# ${episodeName} 剧本\n\n`
  );

  return {
    episodeName,
    created: [
      episodeDir,
      join(episodeDir, OUTLINE_FILENAME),
      join(episodeDir, SCRIPT_FILENAME),
      scenesDir,
    ],
  };
}

export { createEpisode, createProjectScaffold };
