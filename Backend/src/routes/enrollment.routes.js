// src/routes/enrollment.routes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireStudent } from '../middlewares/student.middleware.js';
import { requireTeacher } from '../middlewares/teacher.middleware.js';
import { requireParentalConsentIfMinor } from '../middlewares/minorConsent.middleware.js';
import { requireIdempotencyKey } from '../middlewares/idempotency.middleware.js';
import { paymentLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  sendQuery, acceptQuery, rejectQuery,
  enrollInClassroom, verifyEnrollmentPayment,
  getStudentEnrollments, getMyQueries, submitReview,
} from '../controllers/enrollment.controller.js';

const router = Router();
router.use(authenticate);

// ── Student: send query (costs 1 token) ──────────────────────────────────────
router.post(
  '/queries',
  requireStudent, requireParentalConsentIfMinor, requireIdempotencyKey,
  sendQuery,
);

// ── Teacher: accept / reject query ───────────────────────────────────────────
router.patch('/queries/:queryId/accept', requireTeacher, acceptQuery);
router.patch('/queries/:queryId/reject', requireTeacher, rejectQuery);

// ── Student: pay and enroll ───────────────────────────────────────────────────
router.post(
  '/queries/:queryId/enroll',
  requireStudent, requireParentalConsentIfMinor, requireIdempotencyKey, paymentLimiter,
  enrollInClassroom,
);
router.post(
  '/queries/:queryId/enroll/verify',
  requireStudent, paymentLimiter,
  verifyEnrollmentPayment,
);

// ── Student: dashboard + query history ───────────────────────────────────────
router.get('/',        requireStudent, getStudentEnrollments);
router.get('/queries', requireStudent, getMyQueries);

// ── Student: post review on completed classroom ───────────────────────────────
router.post('/:enrollmentId/review', requireStudent, submitReview);

export default router;