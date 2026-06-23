// src/routes/teacher.routes.js
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { requireTeacher, requireTeacherPending } from '../middlewares/teacher.middleware.js';
import { handleKYCUpload } from '../middlewares/upload.middleware.js';
import { uploadLimiter } from '../middlewares/rateLimit.middleware.js';
import {
  submitProfile, uploadKYC, getDashboard, getEarnings,
  getMyQueries, getPublicProfile, getMyClassrooms,
  getMyDoubts, updateAvailability,
} from '../controllers/teacher.controller.js';

const router = Router();

// ── Onboarding (teacher account pending KYC) ──────────────────────────────────
router.post('/onboarding/profile', authenticate, requireTeacherPending, submitProfile);
router.post('/onboarding/kyc',     authenticate, requireTeacherPending, uploadLimiter, ...handleKYCUpload, uploadKYC);

// ── Approved teacher routes ───────────────────────────────────────────────────
router.get('/me/dashboard',    authenticate, requireTeacher, getDashboard);
router.get('/me/earnings',     authenticate, requireTeacher, getEarnings);
router.get('/me/classrooms',   authenticate, requireTeacher, getMyClassrooms);
router.get('/me/queries',      authenticate, requireTeacher, getMyQueries);
router.get('/me/doubts',       authenticate, requireTeacher, getMyDoubts);
router.patch('/me/availability', authenticate, requireTeacher, updateAvailability);

// ── Public profile (no auth required) ────────────────────────────────────────
router.get('/:teacherId/public', optionalAuthenticate, getPublicProfile);

export default router;