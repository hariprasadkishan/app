// src/routes/booking.routes.js

import { Router } from 'express';
import {
  createBooking,
  getBooking,
  confirmBooking,
  cancelBooking,
  startSession,
  endSession,
} from '../controllers/booking.controller.js';
import { authenticate }       from '../middlewares/auth.middleware.js';
import { requireStudent }     from '../middlewares/student.middleware.js';
import {
  requireTeacher,
  requireTeacherPending,
}                             from '../middlewares/teacher.middleware.js';
import { validate }           from '../middlewares/validate.middleware.js';
import { paymentLimiter }     from '../middlewares/rateLimit.middleware.js';
import {
  createBookingSchema,
  cancelBookingSchema,
} from '../validators/booking.validator.js';

const router = Router();

// ── Student: create a booking ─────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireStudent,
  paymentLimiter,
  validate(createBookingSchema),
  createBooking,
);

// ── Any authenticated party: view booking ────────────────────────────────────
router.get(
  '/:bookingId',
  authenticate,
  getBooking,
);

// ── Teacher: accept / reject ──────────────────────────────────────────────────
router.patch(
  '/:bookingId/confirm',
  authenticate,
  requireTeacherPending,
  confirmBooking,
);

// ── Any party: cancel ─────────────────────────────────────────────────────────
router.patch(
  '/:bookingId/cancel',
  authenticate,
  validate(cancelBookingSchema),
  cancelBooking,
);

// ── Teacher: session lifecycle ────────────────────────────────────────────────
router.patch(
  '/:bookingId/start',
  authenticate,
  requireTeacherPending,
  startSession,
);

router.patch(
  '/:bookingId/end',
  authenticate,
  requireTeacherPending,
  endSession,
);

export default router;