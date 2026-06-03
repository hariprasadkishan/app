/**
 * security.middleware.js
 *
 * Aggregates all security hardening middleware into a single mountable
 * array so app.js stays clean and security config stays in one place.
 *
 * LAYERS:
 *   1. Helmet            → HTTP security headers
 *   2. HPP              → HTTP Parameter Pollution prevention
 *   3. Request size cap  → Prevent large-payload DoS attacks
 *   4. Compression       → gzip/br for performance (safe at this layer)
 *
 * WHY HPP: An attacker can send ?role=user&role=admin — Express collects
 * these into an array.  If middleware checks array[0] while a downstream
 * check uses .includes(), behaviour diverges.  HPP deduplicates to the
 * last value by default.
 */

import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import helmetOptions from "../config/helmet.config.js";
import env from "../config/env.config.js";

const MAX_REQUEST_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;

export const securityMiddlewares = [
  // 1. Security headers
  helmet(helmetOptions),

  // 2. HTTP Parameter Pollution prevention
  hpp({
    // Whitelist params that legitimately appear multiple times (e.g. filter arrays)
    whitelist: ["tags", "subjects", "availability"],
  }),

  // 3. Compression — only compress responses > 1 KB
  compression({
    threshold: 1024,
    filter(req, res) {
      // Don't compress if client explicitly opts out
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
];

// Exported individually so app.js can pass them to express.json with limit
export const requestSizeLimits = {
  jsonLimit: `${env.MAX_FILE_SIZE_MB}mb`,
  urlencodedLimit: "1mb",   // URL-encoded forms are rarely large
};