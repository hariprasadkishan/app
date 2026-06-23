// src/routes/payout.routes.js
import { Router }       from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireTeacher } from '../middlewares/teacher.middleware.js';
import { requireAdmin }   from '../middlewares/admin.middleware.js';
import {
  getMyPayouts, requestWithdrawal, getPayoutDetail,
  adminGetAllPayouts, adminHoldPayout, adminReleasePayout,
} from '../controllers/payout.controller.js';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES — must be declared BEFORE /:payoutId to prevent Express from
// matching "admin" as a payoutId param (route ordering is top-down in Express).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admin/all',                  authenticate, requireAdmin, adminGetAllPayouts);
router.patch('/admin/:payoutId/hold',     authenticate, requireAdmin, adminHoldPayout);
router.patch('/admin/:payoutId/release',  authenticate, requireAdmin, adminReleasePayout);

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER ROUTES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/',           authenticate, requireTeacher, getMyPayouts);
router.post('/withdraw',  authenticate, requireTeacher, requestWithdrawal);
router.get('/:payoutId',  authenticate, requireTeacher, getPayoutDetail);

export default router;