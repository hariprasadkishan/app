// src/routes/auth.routes.js
import { Router } from 'express';
import {
  signupSendOtp, signupVerifyOtp, signupComplete,
  loginSendOtp, loginVerifyOtp, loginWithPassword,
  googleAuthUrl, googleCallback, googleComplete,
  refreshToken, logout,
} from '../controllers/auth.controller.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

// Apply auth rate limiter to every route in this module
router.use(authLimiter);

// ── Signup ────────────────────────────────────────────────────────────────────
router.post('/signup/send-otp',  signupSendOtp);
router.post('/signup/verify-otp', signupVerifyOtp);
router.post('/signup/complete',  signupComplete);

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login/send-otp',   loginSendOtp);
router.post('/login/verify-otp', loginVerifyOtp);
router.post('/login/password',   loginWithPassword);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/google',           googleAuthUrl);
router.get('/google/callback',  googleCallback);
router.post('/google/complete', googleComplete);

// ── Session ───────────────────────────────────────────────────────────────────
router.post('/refresh', refreshToken);
router.post('/logout',  logout);

export default router;