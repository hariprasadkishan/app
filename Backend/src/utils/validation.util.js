// ─────────────────────────────────────────────────────────────────────────────
// src/utils/validation.util.js
// Input sanitization & validation helpers used by validation middleware.
// ─────────────────────────────────────────────────────────────────────────────
import ApiError from "./ApiError.js";

/**
 * Strip all HTML tags from a string (XSS prevention for text inputs).
 */
export const sanitizeString = (str) =>
  typeof str === "string" ? str.replace(/<[^>]*>/g, "").trim() : str;

/**
 * Recursively sanitize all string fields in an object.
 */
export const sanitizeObject = (obj) => {
  if (typeof obj !== "object" || obj === null) return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string") result[key] = sanitizeString(val);
    else if (typeof val === "object") result[key] = sanitizeObject(val);
    else result[key] = val;
  }
  return result;
};

/**
 * Validate Indian phone number (10 digits, optional +91).
 */
export const isValidIndianPhone = (phone) =>
  /^(\+91)?[6-9]\d{9}$/.test(phone?.replace(/\s/g, ""));

/**
 * Normalise Indian phone to E.164 format (+91XXXXXXXXXX).
 */
export const normalisePhone = (phone) => {
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.startsWith("+91")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
};

/**
 * Check password strength.
 * Min 8 chars, at least one letter and one number.
 */
export const isStrongPassword = (password) =>
  /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);

/**
 * Build a case-insensitive, regex-safe MongoDB search pattern.
 */
export const buildSearchRegex = (query) => {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
};

/**
 * Assert required fields are present; throw 400 if missing.
 */
export const requireFields = (obj, fields) => {
  const missing = fields.filter(
    (f) => obj[f] === undefined || obj[f] === null || obj[f] === ""
  );
  if (missing.length) {
    throw new ApiError(
      400,
      `Missing required fields: ${missing.join(", ")}`,
      missing.map((f) => ({ field: f, message: "Required" })),
      "MISSING_FIELDS"
    );
  }
};

/**
 * Parse and validate a positive integer from a string (e.g., from query params).
 */
export const parsePositiveInt = (value, fieldName = "value") => {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer`, [], "INVALID_PARAM");
  }
  return n;
};
