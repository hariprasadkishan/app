/**
 * validate.middleware.js
 *
 * Factory that creates Express middleware from Zod schemas.
 *
 * WHY ZOD: Zod provides runtime type safety with TypeScript-style ergonomics.
 * Schemas double as documentation and generate precise, field-level errors
 * that the frontend can map to form validation.
 *
 * VALIDATION TARGETS:
 *   body   → req.body
 *   query  → req.query (string-only — Zod coerces automatically)
 *   params → req.params
 *
 * ERROR FORMAT: Each invalid field produces one entry in the errors array:
 *   { field: "email", message: "Invalid email address" }
 *
 * STRIP UNKNOWNS: Zod's .strip() removes unknown keys, preventing
 * mass-assignment vulnerabilities (extra fields never reach the service).
 */

import { ZodError } from "zod";
import ApiError from "../utils/ApiError.js";

/**
 * validate(schema, target?)
 *
 * @param {import("zod").ZodTypeAny} schema - Zod schema to validate against
 * @param {"body" | "query" | "params"} [target="body"] - request property to validate
 * @returns Express middleware
 */
export const validate = (schema, target = "body") => (req, _res, next) => {
  const result = schema.safeParse(req[target]);

  if (!result.success) {
    const errors = (result.error instanceof ZodError ? result.error.errors : []).map(
      (issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })
    );

    throw new ApiError(
      422,
      "Validation failed",
      errors,
      "VALIDATION_ERROR"
    );
  }

  // Replace raw input with parsed + stripped output (safe, typed data)
  req[target] = result.data;
  next();
};

/**
 * validateMultiple(schemas)
 *
 * Validates multiple targets in a single middleware.
 * @param {{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }} schemas
 */
export const validateMultiple = (schemas) => (req, _res, next) => {
  const allErrors = [];

  for (const [target, schema] of Object.entries(schemas)) {
    if (!schema) continue;

    const result = schema.safeParse(req[target]);

    if (!result.success && result.error instanceof ZodError) {
      for (const issue of result.error.errors) {
        allErrors.push({
          field: `${target}.${issue.path.join(".")}`,
          message: issue.message,
          code: issue.code,
        });
      }
    } else if (result.success) {
      req[target] = result.data;
    }
  }

  if (allErrors.length > 0) {
    throw new ApiError(422, "Validation failed", allErrors, "VALIDATION_ERROR");
  }

  next();
};