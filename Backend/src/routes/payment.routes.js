// src/routes/payment.routes.js

import { Router } from 'express';
import {
  verifyPayment,
  getPayment,
} from '../controllers/payment.controller.js';
import { authenticate }    from '../middlewares/auth.middleware.js';
import { requireStudent }  from '../middlewares/student.middleware.js';
import { validate }        from '../middlewares/validate.middleware.js';
import { paymentLimiter }  from '../middlewares/rateLimit.middleware.js';
import {
  verifyPaymentSchema,
} from '../validators/payment.validator.js';

const router = Router();

// ── POST /api/v1/payments/verify ─────────────────────────────────────────────
// Called by frontend after Razorpay checkout succeeds
router.post(
  '/verify',
  authenticate,
  requireStudent,
  paymentLimiter,
  validate(verifyPaymentSchema),
  verifyPayment,
);

// ── GET /api/v1/payments/:paymentId ──────────────────────────────────────────
// Fetch payment details (student / teacher / admin)
router.get(
  '/:paymentId',
  authenticate,
  getPayment,
);

export default router;