// src/routes/student.routes.js

import { Router } from 'express';
import {
  getStudentDashboard,
  getStudentBookings,
  getStudentPayments,
  getStudentProfile,
  updateStudentProfile,
  uploadStudentAvatar,
  getFavourites,
  addFavourite,
  removeFavourite,
} from '../controllers/student.controller.js';
import {
  submitRefundRequest,
  getMyRefundRequests,
  getRefundRequestById,
} from '../controllers/refund.controller.js';
import { authenticate }    from '../middlewares/auth.middleware.js';
import { requireStudent }  from '../middlewares/student.middleware.js';
import { validate }        from '../middlewares/validate.middleware.js';
import { uploadSingle, uploadArray } from '../middlewares/upload.middleware.js';
import { uploadLimiter }   from '../middlewares/rateLimit.middleware.js';
import {
  updateStudentProfileSchema,
  studentBookingQuerySchema,
  studentPaymentQuerySchema,
  submitRefundRequestSchema,
  addFavouriteParamSchema,
} from '../validators/student.validator.js';

const router = Router();

// All student routes require authentication + student role
router.use(authenticate, requireStudent);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/me/profile',  getStudentProfile);
router.put('/me/profile',  validate(updateStudentProfileSchema), updateStudentProfile);

router.post(
  '/me/avatar',
  uploadLimiter,
  ...uploadSingle('avatar'),
  uploadStudentAvatar,
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/me/dashboard', getStudentDashboard);

// ── Bookings ──────────────────────────────────────────────────────────────────
router.get('/me/bookings', validate(studentBookingQuerySchema, 'query'), getStudentBookings);

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/me/payments', validate(studentPaymentQuerySchema, 'query'), getStudentPayments);

// ── Favourites ────────────────────────────────────────────────────────────────
router.get('/me/favourites',                getFavourites);
router.post('/me/favourites/:teacherId',    addFavourite);
router.delete('/me/favourites/:teacherId',  removeFavourite);

// ── Refund requests ───────────────────────────────────────────────────────────
router.post(
  '/me/refund-requests',
  ...uploadArray('evidence', 5),   // optional evidence files
  validate(submitRefundRequestSchema),
  submitRefundRequest,
);

router.get(
  '/me/refund-requests',
  getMyRefundRequests,
);

router.get(
  '/me/refund-requests/:refundId',
  getRefundRequestById,
);

export default router;