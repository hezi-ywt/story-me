const COMMAND_HELP = Object.freeze({
  init: {
    summary: "Create a project scaffold",
    usage: "storyme init --path <project-root> [--type script-single|script-series]",
  },
  "add-episode": {
    summary: "Create an episode folder and docs",
    usage: "storyme add-episode --path <project-root> --episode <EP|number>",
  },
  "new-asset": {
    summary: "Create an asset document",
    usage:
      "storyme new-asset --path <project-root> --type <角色|场景|道具> --name <asset-name> [--description <text>] [--image <file>]",
  },
  ingest: {
    summary: "Import media files",
    usage:
      "storyme ingest --path <project-root> --target <角色|场景|道具|资产|EP|场次> --input <file> [--input <file>] [--mode copy|move] [--episode <EP>] [--scene <scene-name>]",
  },
  search: {
    summary: "Search markdown content",
    usage: "storyme search --path <project-root> [--query <text>] [--type <asset|script|doc>] [--tag <text>] [--json]",
  },
});

const COMMAND_ORDER = Object.freeze(["init", "add-episode", "new-asset", "ingest", "search"]);

function isSupportedCommand(command) {
  return Object.prototype.hasOwnProperty.call(COMMAND_HELP, command);
}

function listSupportedCommands() {
  return [...COMMAND_ORDER];
}

function getUsageHint(command) {
  if (!command || !isSupportedCommand(command)) {
    return "storyme --help";
  }
  return COMMAND_HELP[command].usage;
}

function formatCommandHelp(command) {
  if (!isSupportedCommand(command)) {
    return HELP_TEXT;
  }

  return [
    `Story Me CLI: ${command}`,
    "",
    `Usage:`,
    `  ${COMMAND_HELP[command].usage}`,
    "",
    "Global options:",
    "  --json        Output machine-readable JSON",
    "  --help, -h    Show command help",
  ].join("\n");
}

const HELP_TEXT = [
  "Story Me CLI",
  "",
  "Usage:",
  "  storyme <command> [options]",
  "",
  "Commands:",
  ...COMMAND_ORDER.map((command) => `  ${command.padEnd(11, " ")} ${COMMAND_HELP[command].summary}`),
  "",
  "Global options:",
  "  --json        Output machine-readable JSON",
  "  --help, -h    Show this help",
  "",
  "Examples:",
  "  storyme init --path /tmp/demo --type script-series",
  "  storyme add-episode --path /tmp/demo --episode 1",
  "  storyme new-asset --path /tmp/demo --type 角色 --name 林月 --description 主角 --image linyue.png",
  "  storyme ingest --path /tmp/demo --target 角色 --input /tmp/a.png --input /tmp/b.png --mode copy",
  "  storyme search --path /tmp/demo --query 茶馆 --type script --json",
].join("\n");

export { COMMAND_HELP, HELP_TEXT, formatCommandHelp, getUsageHint, isSupportedCommand, listSupportedCommands };
