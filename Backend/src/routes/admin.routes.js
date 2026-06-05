// src/routes/admin.routes.js

import { Router } from 'express';
import {
  getAdminStats,
  getPendingTeachers,
  getAllTeachers,
  getTeacherDetail,
  approveTeacher,
  rejectTeacher,
  suspendTeacher,
  getAllBookings,
  getRefundRequests,
  approveRefund,
  rejectRefund,
  getRevenueAnalytics,
  getAllUsers,
  banUser,
} from '../controllers/admin.controller.js';
import { authenticate }  from '../middlewares/auth.middleware.js';
import { requireAdmin }  from '../middlewares/admin.middleware.js';
import { validate }      from '../middlewares/validate.middleware.js';
import {
  approveTeacherSchema,
  rejectTeacherSchema,
  suspendTeacherSchema,
  approveRefundSchema,
  rejectRefundSchema,
  banUserSchema,
  adminListQuerySchema,
  analyticsQuerySchema,
} from '../validators/admin.validator.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get('/stats', getAdminStats);

// ── Teacher management ────────────────────────────────────────────────────────
router.get(
  '/teachers/pending',
  validate(adminListQuerySchema, 'query'),
  getPendingTeachers,
);

router.get(
  '/teachers',
  validate(adminListQuerySchema, 'query'),
  getAllTeachers,
);

router.get('/teachers/:teacherId', getTeacherDetail);

router.post(
  '/teachers/:teacherId/approve',
  validate(approveTeacherSchema),
  approveTeacher,
);

router.post(
  '/teachers/:teacherId/reject',
  validate(rejectTeacherSchema),
  rejectTeacher,
);

router.post(
  '/teachers/:teacherId/suspend',
  validate(suspendTeacherSchema),
  suspendTeacher,
);

// ── Booking management ────────────────────────────────────────────────────────
router.get(
  '/bookings',
  validate(adminListQuerySchema, 'query'),
  getAllBookings,
);

// ── Refund management ─────────────────────────────────────────────────────────
router.get(
  '/refunds',
  validate(adminListQuerySchema, 'query'),
  getRefundRequests,
);

router.post(
  '/refunds/:refundId/approve',
  validate(approveRefundSchema),
  approveRefund,
);

router.post(
  '/refunds/:refundId/reject',
  validate(rejectRefundSchema),
  rejectRefund,
);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get(
  '/analytics/revenue',
  validate(analyticsQuerySchema, 'query'),
  getRevenueAnalytics,
);

// ── User management ───────────────────────────────────────────────────────────
router.get(
  '/users',
  validate(adminListQuerySchema, 'query'),
  getAllUsers,
);

router.post(
  '/users/:userId/ban',
  validate(banUserSchema),
  banUser,
);

export default router;