/**
 * requestLogger.middleware.js
 *
 * Structured HTTP request/response logger.
 *
 * WHY: Raw access logs are useless at scale.  We log structured JSON with:
 *   - correlationId    → trace a request end-to-end
 *   - userId           → which user made the request (post-auth only)
 *   - method + url     → what was requested
 *   - statusCode       → outcome
 *   - durationMs       → performance profiling
 *   - ip               → rate-limit / abuse analysis
 *   - userAgent        → client breakdown
 *
 * Sensitive paths (health check) are sampled at low frequency to avoid
 * log noise.  Request bodies are never logged (PII / secrets risk).
 *
 * SCALABILITY: This middleware is O(1) — no DB calls, pure in-memory.
 */

import logger from "../config/logger.config.js";

// Paths we want to skip or sample — tune per environment
const SKIP_PATHS = new Set(["/health", "/favicon.ico"]);

export const requestLoggerMiddleware = (req, res, next) => {
  if (SKIP_PATHS.has(req.path)) return next();

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    const logData = {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      userId: req.user?._id?.toString() ?? null,
      contentLength: res.getHeader("content-length") ?? null,
    };

    const level = res.statusCode >= 500
      ? "error"
      : res.statusCode >= 400
        ? "warn"
        : "http";

    logger[level]("HTTP Request", logData);
  });

  next();
};