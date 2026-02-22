#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseArgv } from "./args.js";
import { executeCommand } from "./commands.js";
import { CliError, runtimeError } from "./errors.js";
import { formatCommandHelp, HELP_TEXT } from "./help.js";
import { emitError, emitSuccess } from "./output.js";

async function runCli(argv = process.argv.slice(2), io = {}) {
  const writeStdout = io.writeStdout ?? ((text) => process.stdout.write(text));
  const writeStderr = io.writeStderr ?? ((text) => process.stderr.write(text));
  const parsed = parseArgv(argv);

  if (!parsed.command || parsed.help) {
    const helpText = parsed.command ? formatCommandHelp(parsed.command) : HELP_TEXT;
    writeStdout(`${helpText}\n`);
    return {
      command: parsed.command || "help",
      exitCode: 0,
      payload: null,
    };
  }

  try {
    const executed = await executeCommand(parsed);
    const payload = emitSuccess({
      command: executed.command,
      result: executed.result,
      json: parsed.json,
      writeStdout,
    });
    return {
      command: executed.command,
      exitCode: 0,
      payload,
    };
  } catch (error) {
    const normalizedError =
      error instanceof CliError
        ? error
        : runtimeError(error instanceof Error ? error.message : String(error));
    const payload = emitError({
      command: parsed.command,
      error: normalizedError,
      json: parsed.json,
      writeStderr,
    });
    return {
      command: parsed.command,
      exitCode: normalizedError.exitCode ?? 1,
      payload,
    };
  }
}

async function main() {
  const outcome = await runCli(process.argv.slice(2));
  process.exitCode = outcome.exitCode;
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { runCli };
