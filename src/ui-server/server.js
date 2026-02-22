import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { notFoundError } from "./api-errors.js";
import { contentTypeForPath } from "./content-types.js";
import { sendError, sendSuccess } from "./http-utils.js";
import { dispatchApi } from "./routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(__dirname, "../ui");

function resolveStaticPath(pathname) {
  if (pathname === "/") {
    return resolve(UI_ROOT, "index.html");
  }

  const candidate = resolve(UI_ROOT, `.${pathname}`);
  if (!candidate.startsWith(UI_ROOT)) {
    throw notFoundError(`Static path not allowed: ${pathname}`);
  }
  return candidate;
}

async function sendStatic(response, pathname) {
  const candidate = resolveStaticPath(pathname);
  try {
    const fileStats = await stat(candidate);
    if (!fileStats.isFile()) {
      throw notFoundError(`Static file not found: ${pathname}`);
    }
    const content = await readFile(candidate);
    response.writeHead(200, {
      "Content-Type": contentTypeForPath(candidate),
      "Content-Length": content.length,
    });
    response.end(content);
    return;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (!pathname.includes(".")) {
        return sendStatic(response, "/index.html");
      }
      throw notFoundError(`Static file not found: ${pathname}`);
    }
    throw error;
  }
}

async function streamFileResponse(response, filePath) {
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw notFoundError(`File not found: ${filePath}`);
    }
    throw error;
  }
  if (!fileStats.isFile()) {
    throw notFoundError(`Path is not a file: ${filePath}`);
  }

  response.writeHead(200, {
    "Content-Type": contentTypeForPath(filePath),
    "Content-Length": fileStats.size,
  });
  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    sendError(response, error);
  });
  stream.pipe(response);
}

function createLocalUiServer(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const port = Number.isInteger(options.port) ? options.port : 4173;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);
      if (url.pathname.startsWith("/api/")) {
        const result = await dispatchApi(request, url);
        if (result && result.kind === "file") {
          await streamFileResponse(response, result.path);
          return;
        }
        sendSuccess(response, result);
        return;
      }

      await sendStatic(response, url.pathname);
    } catch (error) {
      sendError(response, error);
    }
  });

  return {
    server,
    host,
    port,
  };
}

async function startLocalUiServer(options = {}) {
  const { server, host, port } = createLocalUiServer(options);

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const listeningHost = address && typeof address === "object" ? address.address : host;
  const listeningPort = address && typeof address === "object" ? address.port : port;
  const url = `http://${listeningHost}:${listeningPort}`;
  let closePromise = null;

  return {
    server,
    host: listeningHost,
    port: listeningPort,
    url,
    close: () => {
      if (closePromise) {
        return closePromise;
      }
      if (!server.listening) {
        return Promise.resolve();
      }

      closePromise = new Promise((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      });
      return closePromise;
    },
  };
}

export { createLocalUiServer, startLocalUiServer };
