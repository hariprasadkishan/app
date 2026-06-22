import multer from "multer";
import ApiError from "../utils/ApiError.js";
import env from "./env.config.js";

const MAX_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;

// Use memory storage — pipe buffer directly to Cloudinary, no temp files
const storage = multer.memoryStorage();

const fileFilter = (allowedMimes) => (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `File type '${file.mimetype}' not allowed. Allowed: ${allowedMimes.join(", ")}`,
        [],
        "INVALID_FILE_TYPE"
      ),
      false
    );
  }
};

// ── Preset uploaders ──────────────────────────────────────────────────────────

/** Documents: PDF only (KYC, assignments, materials) */
export const uploadPDF = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: fileFilter([
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
});

/** Images only (profile pics, classroom photos) */
export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: fileFilter([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]),
});

/** KYC documents: images + PDF */
export const uploadKYC = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: fileFilter([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
});

/** General material upload: images, PDF, PPT */
export const uploadMaterial = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter: fileFilter([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
});

/** Classroom offline photos/videos */
export const uploadClassroomMedia = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50 MB for videos
  fileFilter: fileFilter([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
  ]),
});
