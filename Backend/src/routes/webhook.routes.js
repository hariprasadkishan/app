// src/routes/webhook.routes.js
// IMPORTANT: This router must be mounted BEFORE express.json() in app.js
// Razorpay webhook signature verification requires the raw request body (Buffer).
import { Router }    from 'express';
import express       from 'express';
import { verifyRazorpayWebhook } from '../middlewares/razorpayWebhook.middleware.js';
import { handleRazorpayWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  verifyRazorpayWebhook,
  handleRazorpayWebhook,
);

export default router;