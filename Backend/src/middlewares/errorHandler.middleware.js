// middlewares/errorHandler.middleware.js
import ApiError from "../utils/ApiError.js";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

export const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId;

  // Mongoose validation error → 422
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors,
      correlationId,
      errorCode: "MONGOOSE_VALIDATION_ERROR",
    });
  }

  // Mongoose duplicate key → 409
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
      errors: [{ field, message: "Already in use" }],
      correlationId,
      errorCode: "DUPLICATE_KEY",
    });
  }

  // Mongoose CastError (invalid ObjectId) → 400
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
      correlationId,
      errorCode: "INVALID_ID",
    });
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large",
      correlationId,
      errorCode: "FILE_TOO_LARGE",
    });
  }

  // Our own ApiError
  if (err instanceof ApiError) {
    logger.warn("ApiError", {
      statusCode: err.statusCode,
      message: err.message,
      errorCode: err.errorCode ?? err.errors,
      correlationId,
      path: req.originalUrl,
    });
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      correlationId,
      errorCode: err.errorCode ?? null,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      correlationId,
      errorCode: "AUTH_INVALID",
    });
  }

  // Unexpected — never leak stack in prod
  logger.error("Unhandled error", {
    message: err.message,
    stack: err.stack,
    correlationId,
    path: req.originalUrl,
  });

  return res.status(500).json({
    success: false,
    message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
    correlationId,
    errorCode: "INTERNAL_ERROR",
  });
};