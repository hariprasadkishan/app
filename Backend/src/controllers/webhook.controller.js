// src/controllers/webhook.controller.js
import mongoose from 'mongoose';
import { Payment, Enrollment, EnrollmentQuery, StudentWallet, TeacherProfile, User, Classroom } from '../models/index.js';
import { WalletService }    from '../services/wallet.service.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler }     from '../utils/AsyncHandler.js';
import ApiResponse          from '../utils/ApiResponse.js';
import { PAYMENT_STATUS, PAYMENT_PURPOSE, ENROLLMENT_STATUS, QUERY_STATUS } from '../constants/enums.js';
import { PLATFORM_FEE }     from '../constants/app.constants.js';
import logger               from '../config/logger.config.js';

// ── POST /api/webhooks/razorpay ───────────────────────────────────────────────
// Middleware chain: express.raw() → verifyRazorpayWebhook → this handler
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const event = req.webhookEvent;    // set by verifyRazorpayWebhook middleware
  const payload = req.body;          // raw Buffer already parsed by that middleware

  logger.info('Razorpay webhook received', { event });

  // Always respond 200 immediately to avoid Razorpay retrying
  res.status(200).json(new ApiResponse(200, null, 'Webhook received'));

  // Process asynchronously after responding (fire and forget with error capture)
  setImmediate(() => _processWebhook(event, payload).catch((err) => {
    logger.error('Webhook processing error', { event, error: err.message, stack: err.stack });
  }));
});

async function _processWebhook(event, payload) {
  const paymentEntity = payload?.payload?.payment?.entity;
  if (!paymentEntity) return;

  const { order_id: orderId, id: razorpayPaymentId, method } = paymentEntity;

  if (event === 'payment.captured') {
    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment) {
      logger.warn('Webhook: payment record not found', { orderId });
      return;
    }

    // Idempotency: skip if already captured
    if (payment.status === PAYMENT_STATUS.CAPTURED) {
      logger.info('Webhook: payment already captured, skipping', { orderId });
      return;
    }

    await payment.logWebhookEvent(event, paymentEntity);

    // ── Case A: Token Purchase ────────────────────────────────────────────────
    if (payment.purpose === PAYMENT_PURPOSE.TOKEN_PURCHASE) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await payment.capture({ razorpayPaymentId, razorpaySignature: null, method });
        await WalletService.creditTokens(payment.payerId, payment._id, session);
        await session.commitTransaction();

        const user = await User.findById(payment.payerId).select('phone');
        NotificationService.notifyPaymentSuccess(user, payment.totalAmountPaise, 'token purchase').catch(() => {});
        logger.info('Webhook: tokens credited', { userId: payment.payerId, tokens: PLATFORM_FEE.TOKENS_PER_PURCHASE });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
      return;
    }

    // ── Case B: Enrollment Fee ────────────────────────────────────────────────
    if (payment.purpose === PAYMENT_PURPOSE.ENROLLMENT_FEE) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await payment.capture({ razorpayPaymentId, razorpaySignature: null, method });

        const query = await EnrollmentQuery.findById(payment.queryId).session(session);
        if (!query) { await session.abortTransaction(); return; }
        if (query.status === QUERY_STATUS.ENROLLED) {
          // Already enrolled (double webhook) — commit capture only
          await session.commitTransaction();
          return;
        }

        const classroom = await Classroom.findById(payment.classroomId).session(session);

        const [enrollment] = await Enrollment.create([{
          studentId:           payment.payerId,
          classroomId:         payment.classroomId,
          teacherId:           classroom.teacherId,
          queryId:             query._id,
          paymentId:           payment._id,
          feesPaidPaise:       payment.totalAmountPaise,
          teacherDepositPaise: query.teacherDepositPaise,
          status:              ENROLLMENT_STATUS.ACTIVE,
        }], { session });

        await query.markEnrolled(enrollment._id);
        await Classroom.findByIdAndUpdate(classroom._id, { $inc: { 'stats.enrolledStudents': 1 } }, { session });

        await session.commitTransaction();

        const [student, teacher] = await Promise.all([
          User.findById(payment.payerId).select('phone name'),
          User.findById(classroom.teacherId).select('phone name'),
        ]);
        NotificationService.notifyEnrollmentConfirmed(student, teacher, classroom).catch(() => {});
        logger.info('Webhook: enrollment created from payment', { enrollmentId: enrollment._id });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
      return;
    }

    // ── Case C: Teacher Deposit (GAP 3 FINALIZE) ──────────────────────────────
    if (payment.purpose === PAYMENT_PURPOSE.TEACHER_DEPOSIT) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await payment.capture({ razorpayPaymentId, razorpaySignature: null, method });

        const query = await EnrollmentQuery.findById(payment.queryId).session(session);
        if (!query) { await session.abortTransaction(); return; }
        if (query.status !== QUERY_STATUS.PENDING) {
          // Already processed
          await session.commitTransaction();
          return;
        }

        const classroom = await Classroom.findById(query.classroomId).lean();
        const depositPaise = payment.totalAmountPaise;

        // Mark deposit paid and advance query to accepted
        query.teacherDepositPaid    = true;
        query.status                = QUERY_STATUS.ACCEPTED;
        query.respondedAt           = new Date();
        query.teacherDepositPaise   = depositPaise;
        query.studentEnrollDeadline = new Date(Date.now() + 5 * 86400000);
        await query.save({ session });

        await Classroom.findByIdAndUpdate(query.classroomId, { $inc: { 'stats.acceptedQueries': 1 } }, { session });
        await session.commitTransaction();

        const student = await User.findById(query.studentId).select('phone');
        NotificationService.notifyStudentQueryAccepted(student, classroom).catch(() => {});
        logger.info('Webhook: teacher deposit captured, query accepted', { queryId: query._id });
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
      return;
    }
  }

  if (event === 'payment.failed') {
    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (payment && payment.status !== PAYMENT_STATUS.FAILED) {
      payment.status      = PAYMENT_STATUS.FAILED;
      payment.failedAt    = new Date();
      payment.failureCode = paymentEntity.error_code || null;
      payment.failureMessage = paymentEntity.error_description || null;
      await payment.logWebhookEvent(event, paymentEntity);
      logger.warn('Webhook: payment failed', { orderId, reason: paymentEntity.error_description });
    }
  }

  if (event === 'refund.created' || event === 'refund.processed') {
    const refundEntity = payload?.payload?.refund?.entity;
    if (!refundEntity) return;
    const payment = await Payment.findOne({ razorpayOrderId: refundEntity.payment_id });
    if (payment) {
      await payment.addRefund({
        razorpayRefundId: refundEntity.id,
        amountPaise:      refundEntity.amount,
        reason:           refundEntity.notes?.reason || 'Razorpay refund',
      });
      logger.info('Webhook: refund recorded', { refundId: refundEntity.id });
    }
  }
}