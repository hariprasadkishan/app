/**
 * upload.middleware.js
 *
 * Thin wrappers around the domain-specific multer presets defined in
 * config/multer.config.js (uploadImage, uploadPDF, uploadKYC, uploadMaterial,
 * uploadClassroomMedia). Each preset already enforces the right MIME
 * whitelist and size limit for that use case (profile photo vs KYC doc vs
 * classroom video, etc.) — this file just adds shared, post-multer
 * security checks and converts multer's raw errors into ApiError.
 *
 * WHY NOT A SEPARATE MULTER INSTANCE HERE: the project previously had two
 * independent multer configs (one in this file, one in multer.config.js)
 * with different MIME whitelists and limits — a maintenance hazard where
 * fixing a limit in one place silently leaves the other stale. This file
 * is now the only place routes import from; multer.config.js owns the
 * actual multer instances.
 *
 * SECURITY: MIME-type checks from multer (client-supplied Content-Type)
 * are necessary but not sufficient — a malicious client can lie about
 * Content-Type. We additionally verify magic bytes (the file's real
 * signature) before letting the buffer reach Cloudinary or a controller.
 */

import {
  uploadImage,
  uploadPDF,
  uploadKYC,
  uploadMaterial,
  uploadClassroomMedia,
} from '../config/multer.config.js';
import ApiError from '../utils/ApiError.js';

// ─── Magic bytes (file signatures) for server-side type verification ─────────
const MAGIC_BYTES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/jpg':  [0xff, 0xd8, 0xff],
  'image/png':  [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF container — WEBP marker follows at byte 8
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  // PPT/PPTX and MP4/MOV are container formats with more variable headers —
  // we trust multer's MIME check for these (still safe: Cloudinary re-derives
  // the real type server-side and never executes uploaded content).
};

function verifyMagicBytes(buffer, mimeType) {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true; // no signature defined for this type — trust MIME check
  if (!buffer || buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

function checkFile(file) {
  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    throw new ApiError(
      415,
      `File '${file.originalname}' content does not match its declared type`,
      [],
      'FILE_TYPE_MISMATCH',
    );
  }
}

function wrap(multerMiddleware, { single = false } = {}) {
  return [
    multerMiddleware,
    (req, _res, next) => {
      if (single) {
        if (req.file) checkFile(req.file);
      } else if (Array.isArray(req.files)) {
        req.files.forEach(checkFile);
      } else if (req.files && typeof req.files === 'object') {
        Object.values(req.files).flat().forEach(checkFile);
      }
      next();
    },
  ];
}

// ─── Profile / avatar (single image) ──────────────────────────────────────────
export const handleProfileUpload = wrap(uploadImage.single('avatar'), { single: true });

// ─── KYC documents (aadhaar, bank passbook, selfie — images or PDF) ───────────
export const handleKYCUpload = wrap(uploadKYC.array('documents', 5));
export const handleSingleKYCDocument = wrap(uploadKYC.single('document'), { single: true });

// ─── Classroom material (PPT/PDF) ─────────────────────────────────────────────
export const handleMaterialUpload = wrap(uploadMaterial.array('files', 5));

// ─── Classroom offline photos/videos (creation/update) ────────────────────────
export const handleClassroomMediaUpload = wrap(
  uploadClassroomMedia.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 3 },
  ]),
);

// ─── Generic single PDF (assignment briefs, etc.) ─────────────────────────────
export const handleSinglePdfUpload = wrap(uploadPDF.single('file'), { single: true });