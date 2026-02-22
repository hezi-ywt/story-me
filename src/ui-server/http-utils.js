import { ApiError, runtimeError } from "./api-errors.js";

function successPayload(result) {
  return {
    ok: true,
    result,
  };
}

function errorPayload(error) {
  return {
    ok: false,
    error: {
      code: error.code ?? "RUNTIME_ERROR",
      message: error.message ?? "Unknown error",
      details: error.details ?? null,
    },
  };
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendSuccess(response, result, statusCode = 200) {
  sendJson(response, statusCode, successPayload(result));
}

function sendError(response, error) {
  const normalized =
    error instanceof ApiError
      ? error
      : runtimeError(error instanceof Error ? error.message : String(error));
  sendJson(response, normalized.statusCode ?? 500, errorPayload(normalized));
}

function readBody(request, options = {}) {
  const limitBytes = Number.isInteger(options.limitBytes) ? options.limitBytes : 50 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new ApiError(`Request body too large. Limit: ${limitBytes} bytes.`, { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", reject);
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

async function parseJsonBody(request, options = {}) {
  const raw = await readBody(request, options);
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("Invalid JSON request body.", {
      statusCode: 400,
      code: "INVALID_JSON",
    });
  }
}

function ensureString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    throw new ApiError(`${label} must be a string.`, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: { field: label },
    });
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    throw new ApiError(`${label} is required.`, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: { field: label },
    });
  }
  return allowEmpty ? value : trimmed;
}

function optionalString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

export {
  ensureString,
  errorPayload,
  optionalString,
  parseJsonBody,
  sendError,
  sendSuccess,
  successPayload,
  toBoolean,
  toInteger,
};
