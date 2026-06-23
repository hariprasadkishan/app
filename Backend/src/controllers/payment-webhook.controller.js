// src/controllers/payment-webhook.controller.js
import mongoose from 'mongoose';
import { Payment, EnrollmentQuery, Enrollment, Classroom, User } from '../models/index.js';
import { WalletService } from '../services/wallet.service.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { PAYMENT_STATUS, ENROLLMENT_STATUS, PAYMENT_PURPOSE } from '../constants/enums.js';
import logger from '../config/logger.config.js';

// ── POST /webhooks/razorpay — Handle webhook events ───────────────────────────────
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const event = req.webhookEvent;
  if (event.event !== 'payment.captured') {
    logger.info(`Webhook event ignored: ${event.event}`);
    return res.status(200).json(new ApiResponse(200, null, `Event ${event.event} ignored`));
  }

  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) {
    throw ApiError.badRequest('Invalid webhook payload structure');
  }

  const razorpayOrderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;
  const method = paymentEntity.method;

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) {
    logger.warn('Payment record not found for webhook order', { razorpayOrderId });
    return res.status(404).json(new ApiResponse(404, null, 'Payment record not found'));
  }

  if (payment.status === PAYMENT_STATUS.CAPTURED) {
    logger.info('Webhook already processed for order', { razorpayOrderId });
    return res.status(200).json(new ApiResponse(200, null, 'Already processed'));
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await payment.logWebhookEvent(event.event, event);
    await payment.capture({ razorpayPaymentId, razorpaySignature: 'webhook_verified', method });

    if (payment.purpose === PAYMENT_PURPOSE.TOKEN_PURCHASE) {
      // Case C: Token Purchase Webhook Settlement
      await WalletService.creditTokens(payment.payerId, payment._id, session);
      logger.info('Webhook: Tokens credited successfully', { orderId: razorpayOrderId });
    } 
    else if (payment.purpose === PAYMENT_PURPOSE.ENROLLMENT_FEE) {
      // Case A: Enrollment Fee Webhook Settlement
      const query = await EnrollmentQuery.findById(payment.queryId).session(session);
      if (!query) throw ApiError.notFound('Enrollment query');

      const classroom = await Classroom.findById(payment.classroomId).session(session);
      if (!classroom) throw ApiError.notFound('Classroom');

      // Create Enrollment
      const [enrollment] = await Enrollment.create([{
        studentId: payment.payerId,
        classroomId: payment.classroomId,
        teacherId: payment.teacherId,
        queryId: payment.queryId,
        paymentId: payment._id,
        feesPaidPaise: payment.totalAmountPaise,
        teacherDepositPaise: query.teacherDepositPaise,
        status: ENROLLMENT_STATUS.ACTIVE,
      }], { session });

      // Update query and classroom stats
      await query.markEnrolled(enrollment._id);
      await Classroom.findByIdAndUpdate(payment.classroomId, { $inc: { 'stats.enrolledStudents': 1 } }, { session });

      // Send notifications
      const [student, teacher] = await Promise.all([
        User.findById(payment.payerId).select('phone name'),
        User.findById(payment.teacherId).select('phone name'),
      ]);
      NotificationService.notifyEnrollmentConfirmed(student, teacher, classroom).catch(() => {});

      logger.info('Webhook: Enrollment fee captured, student enrolled', { orderId: razorpayOrderId });
    }
    else if (payment.purpose === PAYMENT_PURPOSE.TEACHER_DEPOSIT) {
      // Case B: Teacher Deposit Webhook Finalization
      const query = await EnrollmentQuery.findById(payment.queryId).session(session);
      if (!query) throw ApiError.notFound('Enrollment query');

      const classroom = await Classroom.findById(query.classroomId).session(session);
      if (!classroom) throw ApiError.notFound('Classroom');

      // Accept query
      await query.accept(payment.totalAmountPaise);
      await Classroom.findByIdAndUpdate(query.classroomId, { $inc: { 'stats.acceptedQueries': 1 } }, { session });

      // Send notifications
      const student = await User.findById(query.studentId).select('name phone');
      NotificationService.notifyStudentQueryAccepted(student, classroom).catch(() => {});

      logger.info('Webhook: Teacher deposit captured, query accepted', { orderId: razorpayOrderId });
    }

    await session.commitTransaction();
    res.status(200).json(new ApiResponse(200, null, 'Webhook processed successfully'));
  } catch (err) {
    await session.abortTransaction();
    logger.error('Webhook transaction failed, aborting', { error: err.message });
    throw err;
  } finally {
    session.endSession();
  }
});
