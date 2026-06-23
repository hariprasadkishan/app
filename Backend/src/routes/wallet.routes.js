// src/routes/wallet.routes.js
import { Router } from 'express';
import { authenticate }      from '../middlewares/auth.middleware.js';
import { requireStudent }    from '../middlewares/student.middleware.js';
import { requireIdempotencyKey } from '../middlewares/idempotency.middleware.js';
import { paymentLimiter }    from '../middlewares/rateLimit.middleware.js';
import {
  getWallet, createTokenCheckout, verifyTokenPurchase, getTokenTransactions,
} from '../controllers/wallet.controller.js';

const router = Router();
router.use(authenticate, requireStudent);

router.get('/',                 getWallet);
router.get('/transactions',     getTokenTransactions);
router.post('/tokens/checkout', paymentLimiter, requireIdempotencyKey, createTokenCheckout);
router.post('/tokens/verify',   paymentLimiter, verifyTokenPurchase);

export default router;