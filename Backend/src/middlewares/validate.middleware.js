/**
 * validate.middleware.js
 *
 * Zod-based request validation middleware.
 * Validates req.body, req.params, and req.query against a Zod schema.
 * On failure, maps each issue to a structured error array and throws ApiError 400.
 */

import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

/**
 * Validate a single target (body / params / query) against a Zod schema.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'params'|'query'} target
 */
export const validate = (schema, target = 'body') =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[target]);
      req[target]  = parsed; // replace with coerced/stripped output
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field:   e.path.join('.'),
          message: e.message,
        }));
        return next(new ApiError(400, 'Validation failed', errors, 'VALIDATION_ERROR'));
      }
      next(err);
    }
  };

/**
 * Validate multiple targets in one middleware.
 *
 * @param {{ body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }} schemas
 */
export const validateMultiple = (schemas) =>
  (req, _res, next) => {
    const errors = [];
    for (const [target, schema] of Object.entries(schemas)) {
      try {
        req[target] = schema.parse(req[target]);
      } catch (err) {
        if (err instanceof ZodError) {
          err.errors.forEach((e) => errors.push({
            field:   `${target}.${e.path.join('.')}`,
            message: e.message,
          }));
        }
      }
    }
    if (errors.length > 0) {
      return next(new ApiError(400, 'Validation failed', errors, 'VALIDATION_ERROR'));
    }
    next();
  };