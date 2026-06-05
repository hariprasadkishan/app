// src/routes/webhook.routes.js
//
// CRITICAL: This router must be mounted BEFORE express.json() in app.js
// so that req.rawBody is populated for Razorpay signature verification.
// The raw body middleware is applied only to this route.

import { Router } from 'express';
import { razorpayWebhook } from '../controllers/payment.controller.js';

const router = Router();

// Raw body capture middleware — only for webhook endpoints
const captureRawBody = (req, res, next) => {
  let data = Buffer.alloc(0);
  req.on('data', (chunk) => {
    data = Buffer.concat([data, chunk]);
  });
  req.on('end', () => {
    req.rawBody = data;
    // Also parse as JSON so req.body is available (express.json() is bypassed here)
    try {
      req.body = JSON.parse(data.toString());
    } catch {
      req.body = {};
    }
    next();
  });
  req.on('error', next);
};

// POST /api/webhooks/razorpay
router.post('/razorpay', captureRawBody, razorpayWebhook);

export default router;