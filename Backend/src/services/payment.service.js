import Razorpay from "razorpay";
import crypto from "crypto";
import env from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";

const razorpay = env.RAZORPAY_KEY_ID
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export const PaymentService = {
  async createOrder({ amountPaise, currency = "INR", receipt, notes = {} }) {
    if (!razorpay) throw new ApiError(503, "Payment gateway not configured", [], "PAYMENT_UNAVAILABLE");
    return razorpay.orders.create({ amount: amountPaise, currency, receipt, notes });
  },

  verifyWebhookSignature(rawBody, signature) {
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },

  verifyPaymentSignature({ orderId, paymentId, signature }) {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },
};