class ApiError extends Error {
  constructor(message, { statusCode = 500, code = "RUNTIME_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function validationError(message, details = null) {
  return new ApiError(message, {
    statusCode: 400,
    code: "VALIDATION_ERROR",
    details,
  });
}

function notFoundError(message, details = null) {
  return new ApiError(message, {
    statusCode: 404,
    code: "NOT_FOUND",
    details,
  });
}

function runtimeError(message, details = null) {
  return new ApiError(message, {
    statusCode: 500,
    code: "RUNTIME_ERROR",
    details,
  });
}

export { ApiError, notFoundError, runtimeError, validationError };
