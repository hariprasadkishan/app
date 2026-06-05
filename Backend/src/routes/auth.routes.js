// src/routes/auth.routes.js

import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateMe,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  refreshTokenSchema,
} from '../validators/auth.validators.js';
import { updateStudentProfileSchema } from '../validators/student.validator.js';

const router = Router();

// ── Public OTP routes (rate-limited) ─────────────────────────────────────────
router.post('/send-otp',    authLimiter, validate(sendOtpSchema),    sendOtp);
router.post('/verify-otp',  authLimiter, validate(verifyOtpSchema),  verifyOtp);
router.post('/register',    authLimiter, validate(registerSchema),   register);
router.post('/login',       authLimiter,                             login);

// ── Token management ──────────────────────────────────────────────────────────
router.post('/refresh',  validate(refreshTokenSchema), refreshToken);
router.post('/logout',   authenticate,                 logout);

// ── Authenticated user endpoints ──────────────────────────────────────────────
router.get('/me',  authenticate, getMe);
router.put('/me',  authenticate, validate(updateStudentProfileSchema), updateMe);

export default router;