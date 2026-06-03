/**
 * sanitize.middleware.js
 *
 * Input sanitisation layer.
 *
 * THREATS MITIGATED:
 *   1. NoSQL Injection — Mongoose operators ($where, $gt, $regex …) in
 *      request body / query params are stripped before they reach any
 *      service or model layer.
 *   2. XSS via stored content — HTML tags in string values are escaped so
 *      they cannot execute if ever rendered without further encoding.
 *   3. Prototype pollution — keys like __proto__ or constructor are removed.
 *
 * WHY HERE: Sanitisation must happen before controllers see the data.
 * Centralising it here means individual validators don't need to re-implement
 * the same logic.
 *
 * NOTE: This is a defence-in-depth measure.  Validators (Zod schemas) still
 * run after sanitisation for type / format correctness.
 */

import mongoSanitize from "express-mongo-sanitize";
import xss from "xss";

// ─── NoSQL injection prevention ───────────────────────────────────────────────

/**
 * express-mongo-sanitize strips any key that starts with "$" or contains "."
 * from req.body, req.query, and req.params.
 */
export const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: "_",          // Replace prohibited chars instead of removing
  onSanitizeError(req, _res, key) {
    // Could emit a security alert here in production
    req.sanitizationOccurred = true;
    req.sanitizedKeys = req.sanitizedKeys ?? [];
    req.sanitizedKeys.push(key);
  },
});

// ─── XSS prevention (recursive deep sanitise) ────────────────────────────────

function deepSanitize(value) {
  if (typeof value === "string") return xss(value);
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        // Prototype pollution prevention
        .filter(([k]) => !["__proto__", "constructor", "prototype"].includes(k))
        .map(([k, v]) => [k, deepSanitize(v)])
    );
  }
  return value;
}

export const xssSanitizeMiddleware = (req, _res, next) => {
  if (req.body) req.body = deepSanitize(req.body);
  if (req.query) req.query = deepSanitize(req.query);
  // req.params are URL-encoded strings — safe by definition, but sanitise anyway
  if (req.params) req.params = deepSanitize(req.params);
  next();
};