function successPayload(command, result) {
  return {
    ok: true,
    command,
    result,
  };
}

function errorPayload(command, error) {
  return {
    ok: false,
    command,
    error: {
      code: error.code ?? "RUNTIME_ERROR",
      message: error.message,
      details: error.details ?? null,
    },
  };
}

function formatHumanSuccess(command, result) {
  return [`[ok] ${command}`, JSON.stringify(result, null, 2)].join("\n");
}

function formatHumanError(command, error) {
  const parts = [`[error] ${command}: ${error.message}`];
  if (error.details) {
    parts.push(JSON.stringify(error.details, null, 2));
  }
  return parts.join("\n");
}

function emitSuccess({ command, result, json, writeStdout }) {
  const payload = successPayload(command, result);
  const text = json ? JSON.stringify(payload) : formatHumanSuccess(command, result);
  writeStdout(`${text}\n`);
  return payload;
}

function emitError({ command, error, json, writeStderr }) {
  const payload = errorPayload(command, error);
  const text = json ? JSON.stringify(payload) : formatHumanError(command, error);
  writeStderr(`${text}\n`);
  return payload;
}

export { emitError, emitSuccess };
