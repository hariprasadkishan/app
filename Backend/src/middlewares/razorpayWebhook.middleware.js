/**
 * razorpayWebhook.middleware.js
 *
 * Verifies the authenticity of incoming Razorpay webhook events.
 *
 * CRITICAL: The route this is mounted on MUST use `express.raw({ type:
 * "application/json" })` INSTEAD of the global `express.json()` parser —
 * HMAC verification needs the exact raw byte stream Razorpay signed.
 * If JSON.parse/stringify touches the body first, whitespace/key-order
 * differences will break signature verification.
 *
 * Usage (in routes file, mounted BEFORE the global json body-parser would
 * otherwise apply — Express applies parsers per-route so this is safe):
 *
 *   router.post(
 *     "/webhooks/razorpay",
 *     express.raw({ type: "application/json" }),
 *     verifyRazorpayWebhook,
 *     webhookController.handleRazorpayEvent
 *   );
 */

import { PaymentService } from '../services/payment.service.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.config.js';

export const verifyRazorpayWebhook = (req, _res, next) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    throw new ApiError(401, 'Missing webhook signature', [], 'WEBHOOK_SIGNATURE_MISSING');
  }

  // req.body is a raw Buffer here because of express.raw() on this route
  if (!Buffer.isBuffer(req.body)) {
    throw new ApiError(
      500,
      'Webhook route misconfigured — raw body parser required',
      [],
      'WEBHOOK_RAW_BODY_REQUIRED',
    );
  }

  let isValid;
  try {
    isValid = PaymentService.verifyWebhookSignature(req.body, signature);
  } catch (err) {
    logger.error('Razorpay webhook signature check threw', { message: err.message });
    throw new ApiError(401, 'Invalid webhook signature', [], 'WEBHOOK_SIGNATURE_INVALID');
  }

  if (!isValid) {
    logger.warn('Razorpay webhook signature mismatch', { correlationId: req.correlationId });
    throw new ApiError(401, 'Invalid webhook signature', [], 'WEBHOOK_SIGNATURE_INVALID');
  }

  // Safe now — parse the verified raw buffer into JSON for the controller
  try {
    req.webhookEvent = JSON.parse(req.body.toString('utf8'));
  } catch {
    throw new ApiError(400, 'Malformed webhook payload', [], 'WEBHOOK_PAYLOAD_INVALID');
  }

  next();
};
