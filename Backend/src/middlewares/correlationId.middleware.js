/**
 * correlationId.middleware.js
 *
 * Attaches a unique correlation ID to every request.
 *
 * WHY: Distributed tracing requires a stable identifier that flows from
 * the HTTP layer through service calls, DB queries, and log entries.
 * When a customer reports a bug, we grep logs by correlation ID to get
 * the full picture instantly.
 *
 * CONVENTION: Clients may send their own X-Correlation-ID header (useful
 * for client-side tracing), otherwise we generate a new UUID v4.
 * The ID is echoed back in the response headers so clients can
 * correlate their requests to our logs.
 */

import { randomUUID } from "crypto";

const HEADER = "X-Correlation-ID";

export const correlationIdMiddleware = (req, res, next) => {
  // Honour client-supplied IDs (from gateway / frontend tracing)
  const incoming = req.headers[HEADER.toLowerCase()];
  const correlationId = (typeof incoming === "string" && incoming.trim())
    ? incoming.trim().substring(0, 64)   // cap length to prevent header bloat
    : randomUUID();

  // Attach to request object — available throughout the request lifecycle
  req.correlationId = correlationId;

  // Echo back so clients can correlate responses
  res.setHeader(HEADER, correlationId);

  next();
};