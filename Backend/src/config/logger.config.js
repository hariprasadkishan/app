/**
 * logger.config.js
 *
 * Structured, JSON-formatted logging via Winston.
 *
 * WHY JSON: Machine-parseable logs are essential for log aggregators
 * (Datadog, Loki, CloudWatch).  Every log entry carries a timestamp,
 * level, service tag, and correlation-ID slot so we can trace a request
 * end-to-end across distributed services.
 *
 * LEVELS (descending severity):
 *   error → warn → info → http → debug
 *
 * In production only warn+ goes to stdout; in development debug+ is shown
 * with human-readable colours for DX.
 */

import { createLogger, format, transports } from "winston";
import env from "./env.config.js";

const { combine, timestamp, errors, json, colorize, printf, splat } = format;

// ─── Dev-friendly console format ─────────────────────────────────────────────

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, correlationId, stack }) => {
    const id = correlationId ? ` [${correlationId}]` : "";
    return stack
      ? `${timestamp}${id} ${level}: ${message}\n${stack}`
      : `${timestamp}${id} ${level}: ${message}`;
  })
);

// ─── Production JSON format ───────────────────────────────────────────────────

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

// ─── Logger instance ──────────────────────────────────────────────────────────

const logger = createLogger({
  level: env.NODE_ENV === "production" ? "warn" : "debug",
  defaultMeta: { service: "edtech-backend" },
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    // Future: add transports.Http for centralised log drain
    // Future: add DailyRotateFile for local file rotation
  ],
  exitOnError: false,
});

// ─── Convenience stream for Morgan (HTTP request logging) ────────────────────

logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;