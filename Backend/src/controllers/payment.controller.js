// src/controllers/payment.controller.js
import { Payment, Booking, Payout, User, TeacherProfile } from "../models/index.js";
import { PaymentService } from "../services/payment.service.js";
import { NotificationService } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { validateObjectId } from "../utils/objectId.util.js";
import { BOOKING_STATUS, PAYMENT_STATUS, ESCROW_STATUS, PAYOUT_STATUS, PAYOUT_STAGE } from "../constants/enums.js";
import logger from "../config/logger.config.js";

// ── POST /api/v1/payments/verify ─────────────────────────────────────────────
// Called by student after Razorpay checkout completes
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  const bookingObjId = validateObjectId(bookingId, "bookingId");

  // Verify Razorpay signature
  const isValid = PaymentService.verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!isValid) {
    logger.warn("Invalid Razorpay signature", { bookingId, razorpayOrderId, userId: req.user._id });
    throw new ApiError(400, "Payment verification failed. Invalid signature.", [], "PAYMENT_SIGNATURE_INVALID");
  }

  // Find payment record
  const payment = await Payment.findOne({ bookingId: bookingObjId, razorpayOrderId });
  if (!payment) {
    throw new ApiError(404, "Payment record not found", [], "PAYMENT_NOT_FOUND");
  }

  // Idempotency — already captured
  if (payment.status === PAYMENT_STATUS.CAPTURED) {
    return res.status(200).json(new ApiResponse(200, { payment }, "Payment already captured"));
  }

  // Capture payment
  await payment.capture({
    razorpayPaymentId,
    razorpaySignature,
    method: null,
  });

  // Update booking to CONFIRMED
  const booking = await Booking.findById(bookingObjId);
  if (booking && booking.canTransitionTo(BOOKING_STATUS.CONFIRMED)) {
    booking.status = BOOKING_STATUS.CONFIRMED;
    booking.paymentId = payment._id;
    await booking.save();
  }

  logger.info("Payment captured", { bookingId, paymentId: payment._id, userId: req.user._id });

  res.status(200).json(new ApiResponse(200, { paymentId: payment._id, status: "captured" }, "Payment verified successfully"));
});

// ── POST /api/webhooks/razorpay ───────────────────────────────────────────────
// Raw body required — mounted before express.json() in app.js
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!signature) {
    return res.status(400).json({ success: false, message: "Missing signature" });
  }

  const isValid = PaymentService.verifyWebhookSignature(req.rawBody, signature);
  if (!isValid) {
    logger.warn("Invalid Razorpay webhook signature", { correlationId: req.correlationId });
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const event = req.body;
  const eventType = event.event;

  logger.info("Razorpay webhook received", { event: eventType, correlationId: req.correlationId });

  // Handle payment.captured
  if (eventType === "payment.captured") {
    const payload = event.payload?.payment?.entity;
    if (payload?.order_id) {
      const payment = await Payment.findOne({ razorpayOrderId: payload.order_id });
      if (payment && payment.status !== PAYMENT_STATUS.CAPTURED) {
        await payment.capture({
          razorpayPaymentId: payload.id,
          razorpaySignature: null,
          method: payload.method,
        });
        await payment.logWebhookEvent(eventType, payload);

        const booking = await Booking.findById(payment.bookingId);
        if (booking && booking.canTransitionTo(BOOKING_STATUS.CONFIRMED)) {
          booking.status = BOOKING_STATUS.CONFIRMED;
          booking.paymentId = payment._id;
          await booking.save();
        }
      }
    }
  }

  // Handle payment.failed
  if (eventType === "payment.failed") {
    const payload = event.payload?.payment?.entity;
    if (payload?.order_id) {
      const payment = await Payment.findOne({ razorpayOrderId: payload.order_id });
      if (payment) {
        await payment.logWebhookEvent(eventType, payload);
        payment.status = PAYMENT_STATUS.FAILED;
        payment.failureCode = payload.error_code;
        payment.failureMessage = payload.error_description;
        payment.failedAt = new Date();
        await payment.save();
      }
    }
  }

  // Handle refund.processed
  if (eventType === "refund.processed") {
    const payload = event.payload?.refund?.entity;
    if (payload) {
      const payment = await Payment.findOne({ razorpayOrderId: payload.payment_id });
      if (payment) {
        await payment.addRefund({
          razorpayRefundId: payload.id,
          amountPaise: payload.amount,
          reason: payload.notes?.reason || "Refund processed",
        });
        await payment.logWebhookEvent(eventType, payload);
      }
    }
  }

  // Always 200 to acknowledge
  res.status(200).json({ success: true });
});

// ── GET /api/v1/payments/:paymentId ──────────────────────────────────────────
export const getPayment = asyncHandler(async (req, res) => {
  const paymentId = validateObjectId(req.params.paymentId, "paymentId");

  const payment = await Payment.findById(paymentId)
    .select("-razorpaySignature -idempotencyKey -webhookEvents")
    .lean();

  if (!payment) {
    throw new ApiError(404, "Payment not found", [], "PAYMENT_NOT_FOUND");
  }

  // Ownership check
  const userId = req.user._id.toString();
  const isOwner = payment.studentId?.toString() === userId || payment.teacherId?.toString() === userId;
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Access denied", [], "FORBIDDEN");
  }

  res.status(200).json(new ApiResponse(200, { payment }, "Payment fetched"));
});