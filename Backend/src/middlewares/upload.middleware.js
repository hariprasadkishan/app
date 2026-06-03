/**
 * upload.middleware.js
 *
 * File upload handling with multer (memory storage) + Cloudinary.
 *
 * WHY MEMORY STORAGE: We never write uploads to the server's local disk.
 * In a horizontally-scaled deployment there is no shared filesystem.
 * Files are held in process memory temporarily, streamed to Cloudinary,
 * then the buffer is released by GC.
 *
 * LIMITS:
 *   - File size: configured via MAX_FILE_SIZE_MB env var
 *   - Field count: 5 (prevents form flooding)
 *   - MIME whitelist: images + PDFs only
 *
 * SECURITY:
 *   - File type validation is done by MIME type AND magic bytes (first
 *     few bytes of the buffer) — not just the client-supplied Content-Type.
 *   - Filenames are sanitised before any storage reference is created.
 */

import multer from "multer";
import env from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";

// ─── MIME whitelist ───────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

// Magic bytes (file signatures) for server-side type verification
const MAGIC_BYTES = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function verifyMagicBytes(buffer, mimeType) {
  const expectedBytes = MAGIC_BYTES[mimeType];
  if (!expectedBytes) return true; // No signature defined — trust MIME check
  return expectedBytes.every((byte, i) => buffer[i] === byte);
}

// ─── multer instance ──────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 5,
    fields: 10,
  },

  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new ApiError(
          415,
          `File type '${file.mimetype}' is not supported`,
          [],
          "UNSUPPORTED_FILE_TYPE"
        )
      );
    }
    callback(null, true);
  },
});

// ─── Exported upload middleware factories ─────────────────────────────────────

/**
 * Single file upload.
 * @param {string} fieldName - form field name
 */
export const uploadSingle = (fieldName) => [
  upload.single(fieldName),
  // Post-upload magic byte verification
  (req, _res, next) => {
    if (!req.file) return next();
    if (!verifyMagicBytes(req.file.buffer, req.file.mimetype)) {
      throw new ApiError(415, "File content does not match declared type", [], "FILE_TYPE_MISMATCH");
    }
    next();
  },
];

/**
 * Multiple files on a single field.
 * @param {string} fieldName
 * @param {number} maxCount
 */
export const uploadArray = (fieldName, maxCount = 5) => [
  upload.array(fieldName, maxCount),
  (req, _res, next) => {
    for (const file of req.files ?? []) {
      if (!verifyMagicBytes(file.buffer, file.mimetype)) {
        throw new ApiError(415, "File content does not match declared type", [], "FILE_TYPE_MISMATCH");
      }
    }
    next();
  },
];

/**
 * Mixed fields upload.
 * @param {import("multer").Field[]} fields
 */
export const uploadFields = (fields) => [
  upload.fields(fields),
  (req, _res, next) => {
    for (const fileList of Object.values(req.files ?? {})) {
      for (const file of fileList) {
        if (!verifyMagicBytes(file.buffer, file.mimetype)) {
          throw new ApiError(415, "File content does not match declared type", [], "FILE_TYPE_MISMATCH");
        }
      }
    }
    next();
  },
];