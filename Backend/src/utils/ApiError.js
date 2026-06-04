class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = [], errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;