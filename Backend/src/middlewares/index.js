// ─────────────────────────────────────────────────────────────────────────────
// src/middlewares/index.js — single import point for routes/controllers
// ─────────────────────────────────────────────────────────────────────────────

export { authenticate, optionalAuthenticate } from './auth.middleware.js';
export { requireStudent } from './student.middleware.js';
export {
  requireTeacher,
  requireTeacherPending,
  requireTeacherOrAdmin,
  requireTeacherOwner,
} from './teacher.middleware.js';
export { requireAdmin, requireAdminOrSelf } from './admin.middleware.js';
export { requireParentalConsentIfMinor, blockMinors } from './minorConsent.middleware.js';
export { checkOwnership } from './ownership.middleware.js';
export { requireIdempotencyKey, optionalIdempotency } from './idempotency.middleware.js';
export { verifyRazorpayWebhook } from './razorpayWebhook.middleware.js';
export { validate, validateMultiple } from './validate.middleware.js';
export {
  uploadSingle,
  uploadArray,
  uploadFields,
} from './upload.middleware.js';
export {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  paymentLimiter,
} from './rateLimit.middleware.js';
export { mongoSanitizeMiddleware, xssSanitizeMiddleware } from './sanitize.middleware.js';
export { securityMiddlewares, requestSizeLimits } from './security.middleware.js';
export { correlationIdMiddleware } from './correlationId.middleware.js';
export { requestLoggerMiddleware } from './requestLogger.middleware.js';
export { errorHandler } from './errorHandler.middleware.js';
export { notFound } from './notFound.middleware.js';
