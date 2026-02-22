#!/usr/bin/env node

import { startLocalUiServer } from "./server.js";

async function main() {
  const portEnv = Number.parseInt(process.env.STORYME_UI_PORT ?? "", 10);
  const port = Number.isInteger(portEnv) ? portEnv : 4173;
  const host = process.env.STORYME_UI_HOST || "127.0.0.1";

  const runtime = await startLocalUiServer({ host, port });
  process.stdout.write(`[storyme-ui] running at ${runtime.url}\n`);

  const shutdown = async () => {
    process.stdout.write("[storyme-ui] shutting down\n");
    await runtime.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    shutdown().catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
  });
  process.on("SIGTERM", () => {
    shutdown().catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
