class CliError extends Error {
  constructor(message, { code = "RUNTIME_ERROR", exitCode = 1, details = null } = {}) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

function validationError(message, details = null) {
  return new CliError(message, {
    code: "VALIDATION_ERROR",
    exitCode: 2,
    details,
  });
}

function runtimeError(message, details = null) {
  return new CliError(message, {
    code: "RUNTIME_ERROR",
    exitCode: 1,
    details,
  });
}

export { CliError, runtimeError, validationError };
