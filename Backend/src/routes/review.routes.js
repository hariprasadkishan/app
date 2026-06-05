// src/routes/review.routes.js

import { Router } from 'express';
import {
  createReview,
  getTeacherReviews,
  getMyReviews,
} from '../controllers/review.controller.js';
import { authenticate }    from '../middlewares/auth.middleware.js';
import { requireStudent }  from '../middlewares/student.middleware.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { validate }        from '../middlewares/validate.middleware.js';
import {
  createReviewSchema,
  teacherReviewsQuerySchema,
  reviewQuerySchema,
} from '../validators/review.validator.js';

const router = Router();

// ── POST /api/v1/reviews ──────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireStudent,
  validate(createReviewSchema),
  createReview,
);

// ── GET /api/v1/reviews/teacher/:teacherId ────────────────────────────────────
// Public — no auth required
router.get(
  '/teacher/:teacherId',
  optionalAuthenticate,
  validate(teacherReviewsQuerySchema, 'query'),
  getTeacherReviews,
);

// ── GET /api/v1/reviews/me ────────────────────────────────────────────────────
// Student — reviews they wrote
router.get(
  '/me',
  authenticate,
  requireStudent,
  validate(reviewQuerySchema, 'query'),
  getMyReviews,
);

export default router;