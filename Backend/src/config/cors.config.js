/**
 * cors.config.js
 *
 * Hardened CORS configuration.
 *
 * WHY: Using wildcard "*" in production is a security vulnerability.
 * We maintain an explicit allowlist, validate dynamically, and restrict
 * which headers and methods are exposed.  Preflight caching (maxAge)
 * reduces OPTIONS overhead at scale.
 */

import env from "./env.config.js";

const allowedOriginsSet = new Set(env.ALLOWED_ORIGINS);

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests (origin is undefined) only in dev.
    // In production every browser request carries an Origin header.
    if (!origin) {
      if (env.NODE_ENV !== "production") return callback(null, true);
      return callback(new Error("Origin header required in production"));
    }

    if (allowedOriginsSet.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Correlation-ID",        // Forward correlation IDs from client
    "X-Requested-With",
  ],

  exposedHeaders: [
    "X-Correlation-ID",        // Client can read the correlation ID back
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ],

  credentials: true,           // Allow cookies / Authorization header
  maxAge: 600,                 // Cache preflight for 10 min
  optionsSuccessStatus: 204,
};

export default corsOptions;