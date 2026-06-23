// src/routes/payout.routes.js
import { Router } from 'express';
import { authenticate }   from '../middlewares/auth.middleware.js';
import { requireTeacher } from '../middlewares/teacher.middleware.js';
import { requireAdmin }   from '../middlewares/admin.middleware.js';
import {
  getMyPayouts, requestWithdrawal, getPayoutDetail,
  adminGetAllPayouts, adminHoldPayout, adminReleasePayout,
} from '../controllers/payout.controller.js';

const router = Router();

// ── Teacher payout routes ─────────────────────────────────────────────────────
router.get('/',            authenticate, requireTeacher, getMyPayouts);
router.post('/withdraw',   authenticate, requireTeacher, requestWithdrawal);
router.get('/:payoutId',   authenticate, requireTeacher, getPayoutDetail);

// ── Admin payout routes ───────────────────────────────────────────────────────
router.get('/admin/all',                     authenticate, requireAdmin, adminGetAllPayouts);
router.patch('/admin/:payoutId/hold',        authenticate, requireAdmin, adminHoldPayout);
router.patch('/admin/:payoutId/release',     authenticate, requireAdmin, adminReleasePayout);

export default router;