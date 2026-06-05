// src/routes/teacher.routes.js

import { Router } from 'express';
import {
  searchTeachers,
  getTeacherPublicProfile,
  getMyProfile,
  submitKyc,
  updateMyProfile,
  uploadAvatar,
  uploadDocument,
  getMyDocuments,
  setAvailability,
  getTeacherDashboard,
  getTeacherBookings,
  getTeacherEarnings,
  getTeacherStudents,
} from '../controllers/teacher.controller.js';
import { getTeacherReceivedReviews } from '../controllers/review.controller.js';
import { authenticate }         from '../middlewares/auth.middleware.js';
import { requireTeacher, requireTeacherPending } from '../middlewares/teacher.middleware.js';
import { validate }             from '../middlewares/validate.middleware.js';
import { uploadSingle }         from '../middlewares/upload.middleware.js';
import { uploadLimiter }        from '../middlewares/rateLimit.middleware.js';
import {
  teacherProfileSchema,
  availabilitySlotSchema,
  teacherSearchSchema,
} from '../validators/teacher.validator.js';
import { z } from 'zod';

const router = Router();

// ── Public routes ─────────────────────────────────────────────────────────────

// GET /api/v1/teachers?subjects=&city=&page=
router.get('/', validate(teacherSearchSchema, 'query'), searchTeachers);

// GET /api/v1/teachers/:teacherId
router.get('/:teacherId', getTeacherPublicProfile);

// ── Authenticated teacher routes ──────────────────────────────────────────────

// KYC & onboarding (pending profile allowed)
router.get(
  '/me/profile',
  authenticate,
  requireTeacherPending,
  getMyProfile,
);

router.post(
  '/kyc',
  authenticate,
  requireTeacherPending,
  validate(teacherProfileSchema),
  submitKyc,
);

router.post(
  '/me/avatar',
  authenticate,
  requireTeacherPending,
  uploadLimiter,
  ...uploadSingle('avatar'),
  uploadAvatar,
);

router.post(
  '/me/documents',
  authenticate,
  requireTeacherPending,
  uploadLimiter,
  ...uploadSingle('document'),
  uploadDocument,
);

router.get(
  '/me/documents',
  authenticate,
  requireTeacherPending,
  getMyDocuments,
);

// Approved teacher only
router.put(
  '/me/profile',
  authenticate,
  requireTeacher,
  validate(teacherProfileSchema.partial()),
  updateMyProfile,
);

router.post(
  '/me/availability',
  authenticate,
  requireTeacher,
  validate(z.object({
    isAvailable: z.boolean().optional(),
    slots: z.array(availabilitySlotSchema).max(50).optional(),
  })),
  setAvailability,
);

router.get(
  '/me/dashboard',
  authenticate,
  requireTeacherPending,
  getTeacherDashboard,
);

router.get(
  '/me/bookings',
  authenticate,
  requireTeacherPending,
  validate(z.object({
    status: z.enum(['pending','confirmed','in_progress','completed','cancelled','disputed','refunded']).optional(),
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(50).default(20),
  }), 'query'),
  getTeacherBookings,
);

router.get(
  '/me/earnings',
  authenticate,
  requireTeacher,
  validate(z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }), 'query'),
  getTeacherEarnings,
);

router.get(
  '/me/students',
  authenticate,
  requireTeacher,
  validate(z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().max(100).optional(),
  }), 'query'),
  getTeacherStudents,
);

router.get(
  '/me/reviews',
  authenticate,
  requireTeacherPending,
  validate(z.object({
    page:  z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }), 'query'),
  getTeacherReceivedReviews,
);

export default router;