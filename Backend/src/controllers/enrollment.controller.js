// src/controllers/enrollment.controller.js
import mongoose from 'mongoose';
import {
  Classroom, EnrollmentQuery, Enrollment, Payment,
  StudentWallet, User, TeacherProfile,
} from '../models/index.js';
import { WalletService }     from '../services/wallet.service.js';
import { EscrowService }     from '../services/escrow.service.js';
import { PaymentService }    from '../services/payment.service.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler }      from '../utils/AsyncHandler.js';
import ApiError              from '../utils/ApiError.js';
import ApiResponse           from '../utils/ApiResponse.js';
import { QUERY_STATUS, PAYMENT_PURPOSE, PAYMENT_STATUS, ENROLLMENT_STATUS } from '../constants/enums.js';
import { calcTeacherDeposit } from '../utils/finance.util.js';
import logger                from '../config/logger.config.js';

// ── POST /queries — Student sends enrollment query ────────────────────────────
export const sendQuery = asyncHandler(async (req, res) => {
  const { classroomId, message = '' } = req.body;
  if (!classroomId) throw ApiError.badRequest('classroomId is required');

  const classroom = await Classroom.findById(classroomId);
  if (!classroom) throw ApiError.notFound('Classroom');
  if (!classroom.canAcceptStudents()) {
    throw new ApiError(400, 'Classroom is not accepting new students', [], 'CLASSROOM_CLOSED');
  }

  // Check for existing active query
  const existingQuery = await EnrollmentQuery.findActiveQuery(req.user._id, classroomId);
  if (existingQuery) {
    throw new ApiError(409, 'You already have an active query for this classroom', [], 'DUPLICATE_QUERY');
  }

  // Check if already enrolled
  const existing = await Enrollment.findOne({ studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE });
  if (existing) {
    throw new ApiError(409, 'You are already enrolled in this classroom', [], 'ALREADY_ENROLLED');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // PRE-ALLOCATE THE ID: Safely generates the target ID before document creation
    const allocatedQueryId = new mongoose.Types.ObjectId();

    // Debit exactly 1 token ONCE with the pre-bound reference payload
    await WalletService.debitToken(req.user._id, allocatedQueryId, classroomId, session);

    const [query] = await EnrollmentQuery.create([{
      _id:                 allocatedQueryId, // Inject pre-allocated ID
      studentId:           req.user._id,
      classroomId,
      teacherId:           classroom.teacherId,
      message:             message.trim(),
      teacherDepositPaise: calcTeacherDeposit(classroom.feesPaise),
    }], { session });

    await Classroom.findByIdAndUpdate(classroomId, { $inc: { 'stats.totalQueries': 1 } }, { session });
    await session.commitTransaction();

    // Non-blocking notifications
    const [student, teacher] = await Promise.all([
      User.findById(req.user._id).select('name phone'),
      User.findById(classroom.teacherId).select('name phone'),
    ]);
    NotificationService.notifyTeacherNewQuery(teacher, student, classroom).catch(() => {});

    logger.info('Enrollment query processed safely with single token debit', { queryId: query._id, studentId: req.user._id });
    res.status(201).json(new ApiResponse(201, query, 'Enrollment request sent'));
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── PATCH /queries/:queryId/accept — Teacher accepts query (4% gateway) ────────
export const acceptQuery = asyncHandler(async (req, res) => {
  const { queryId } = req.params;

  const query = await EnrollmentQuery.findById(queryId);
  if (!query) throw ApiError.notFound('Query');
  if (query.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You do not own this query');
  }
  if (query.status !== QUERY_STATUS.PENDING) {
    throw new ApiError(400, `Query is already ${query.status}`, [], 'INVALID_STATUS');
  }

  const classroom = await Classroom.findById(query.classroomId);
  if (!classroom) throw ApiError.notFound('Classroom');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { charged, depositPaise } = await EscrowService.chargeTeacherDeposit(
      req.user._id, query._id, classroom.feesPaise, session,
    );

    if (charged) {
      // Branch A: wallet had sufficient balance — proceed immediately
      await query.accept(depositPaise);
      await Classroom.findByIdAndUpdate(query.classroomId, { $inc: { 'stats.acceptedQueries': 1 } }, { session });
      await session.commitTransaction();

      const student = await User.findById(query.studentId).select('name phone');
      NotificationService.notifyStudentQueryAccepted(student, classroom).catch(() => {});

      logger.info('Query accepted (deposit charged from wallet)', { queryId, teacherId: req.user._id });
      return res.status(200).json(new ApiResponse(200, { status: 'accepted', query }, 'Query accepted'));
    }

    // Branch B: insufficient wallet — need teacher to top-up via Razorpay
    const order = await PaymentService.createOrder({
      amountPaise: depositPaise,
      receipt:     `dep_${queryId.toString().slice(-8)}_${Date.now()}`,
      notes:       { purpose: PAYMENT_PURPOSE.TEACHER_DEPOSIT, queryId: queryId.toString(), teacherId: req.user._id.toString() },
    });

    // Link the pending payment to the query
    await Payment.findOneAndUpdate(
      { queryId: query._id, purpose: PAYMENT_PURPOSE.TEACHER_DEPOSIT, status: PAYMENT_STATUS.CREATED },
      { razorpayOrderId: order.id },
      { session },
    );

    await session.commitTransaction();

    logger.info('Query accept pending deposit payment', { queryId, teacherId: req.user._id });
    return res.status(202).json(new ApiResponse(202, {
      status:       'pending_payment',
      depositPaise,
      razorpayOrder: order,
    }, 'Deposit payment required to confirm acceptance'));

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── PATCH /queries/:queryId/reject — Teacher rejects query ───────────────────
export const rejectQuery = asyncHandler(async (req, res) => {
  const { queryId } = req.params;
  const { reason = '' } = req.body;

  const query = await EnrollmentQuery.findById(queryId);
  if (!query) throw ApiError.notFound('Query');
  if (query.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You do not own this query');
  }
  if (query.status !== QUERY_STATUS.PENDING) {
    throw new ApiError(400, `Query is already ${query.status}`, [], 'INVALID_STATUS');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await query.reject(reason);
    await WalletService.refundToken(query.studentId, query._id, 'Token refunded: query rejected by teacher', session);
    await session.commitTransaction();

    const [student, classroom] = await Promise.all([
      User.findById(query.studentId).select('phone'),
      Classroom.findById(query.classroomId).select('title'),
    ]);
    NotificationService.notifyStudentQueryRejected(student, classroom).catch(() => {});

    res.status(200).json(new ApiResponse(200, null, 'Query rejected, token refunded to student'));
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── POST /queries/:queryId/enroll — Student pays and enrolls ──────────────────
export const enrollInClassroom = asyncHandler(async (req, res) => {
  const { queryId }        = req.params;
  const { useWalletCash }  = req.body;

  const query = await EnrollmentQuery.findById(queryId).populate('classroomId');
  if (!query) throw ApiError.notFound('Query');
  if (query.studentId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('This query does not belong to you');
  }
  if (query.status !== QUERY_STATUS.ACCEPTED) {
    throw new ApiError(400, 'Query must be in accepted status to enroll', [], 'QUERY_NOT_ACCEPTED');
  }
  if (query.studentEnrollDeadline && query.studentEnrollDeadline < new Date()) {
    throw new ApiError(400, 'Enrollment window has expired', [], 'ENROLLMENT_EXPIRED');
  }

  const classroom = query.classroomId;

  if (useWalletCash) {
    // Internal wallet settlement
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await WalletService.debitCashOrThrow(req.user._id, classroom.feesPaise, session);

      const [payment] = await Payment.create([{
        purpose:          PAYMENT_PURPOSE.ENROLLMENT_FEE,
        payerId:          req.user._id,
        classroomId:      classroom._id,
        queryId:          query._id,
        teacherId:        classroom.teacherId,
        totalAmountPaise: classroom.feesPaise,
        status:           PAYMENT_STATUS.CAPTURED,
        gateway:          'manual',
        escrowStatus:     'holding',
        escrowHeldAt:     new Date(),
        capturedAt:       new Date(),
      }], { session });

      const [enrollment] = await Enrollment.create([{
        studentId:          req.user._id,
        classroomId:        classroom._id,
        teacherId:          classroom.teacherId,
        queryId:            query._id,
        paymentId:          payment._id,
        feesPaidPaise:      classroom.feesPaise,
        teacherDepositPaise: query.teacherDepositPaise,
        status:             ENROLLMENT_STATUS.ACTIVE,
      }], { session });

      await query.markEnrolled(enrollment._id);
      await Classroom.findByIdAndUpdate(classroom._id, { $inc: { 'stats.enrolledStudents': 1 } }, { session });

      await session.commitTransaction();

      const [student, teacher] = await Promise.all([
        User.findById(req.user._id).select('phone name'),
        User.findById(classroom.teacherId).select('phone name'),
      ]);
      NotificationService.notifyEnrollmentConfirmed(student, teacher, classroom).catch(() => {});

      return res.status(201).json(new ApiResponse(201, enrollment, 'Enrolled successfully'));
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // Gateway payment — return Razorpay order
  const order = await PaymentService.createEnrollmentOrder(req.user._id, classroom._id, classroom.feesPaise);

  const payment = await Payment.create({
    purpose:          PAYMENT_PURPOSE.ENROLLMENT_FEE,
    payerId:          req.user._id,
    classroomId:      classroom._id,
    queryId:          query._id,
    teacherId:        classroom.teacherId,
    totalAmountPaise: classroom.feesPaise,
    status:           PAYMENT_STATUS.CREATED,
    razorpayOrderId:  order.id,
    idempotencyKey:   req.idempotencyKey || null,
  });

  res.status(200).json(new ApiResponse(200, {
    razorpayOrder:  order,
    paymentId:      payment._id,
    amountPaise:    classroom.feesPaise,
  }, 'Payment order created. Complete payment to enroll.'));
});

// ── POST /queries/:queryId/enroll/verify — Verify enrollment payment ──────────
export const verifyEnrollmentPayment = asyncHandler(async (req, res) => {
  const { queryId } = req.params;
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw ApiError.badRequest('razorpayOrderId, razorpayPaymentId and razorpaySignature are required');
  }

  const isValid = PaymentService.verifyPaymentSignature({
    orderId:   razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!isValid) throw new ApiError(400, 'Invalid payment signature', [], 'PAYMENT_SIGNATURE_INVALID');

  const query = await EnrollmentQuery.findById(queryId).populate('classroomId');
  if (!query || query.studentId.toString() !== req.user._id.toString()) {
    throw ApiError.notFound('Query');
  }

  const payment = await Payment.findOne({ razorpayOrderId, payerId: req.user._id });
  if (!payment) throw ApiError.notFound('Payment record');

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await payment.capture({ razorpayPaymentId, razorpaySignature, method: null });

    const classroom = query.classroomId;

    const [enrollment] = await Enrollment.create([{
      studentId:           req.user._id,
      classroomId:         classroom._id,
      teacherId:           classroom.teacherId,
      queryId:             query._id,
      paymentId:           payment._id,
      feesPaidPaise:       classroom.feesPaise,
      teacherDepositPaise: query.teacherDepositPaise,
      status:              ENROLLMENT_STATUS.ACTIVE,
    }], { session });

    await query.markEnrolled(enrollment._id);
    await Classroom.findByIdAndUpdate(classroom._id, { $inc: { 'stats.enrolledStudents': 1 } }, { session });

    await session.commitTransaction();

    const [student, teacher] = await Promise.all([
      User.findById(req.user._id).select('phone name'),
      User.findById(classroom.teacherId).select('phone name'),
    ]);
    NotificationService.notifyEnrollmentConfirmed(student, teacher, classroom).catch(() => {});

    res.status(201).json(new ApiResponse(201, enrollment, 'Enrollment confirmed'));
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── GET / — Student enrollment dashboard ─────────────────────────────────────
export const getStudentEnrollments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const result = await Enrollment.studentDashboard(req.user._id, {
    page: Number(page), limit: Math.min(Number(limit), 20),
  });

  res.status(200).json(new ApiResponse(200, result, 'Your enrolled classrooms'));
});

// ── GET /queries — Student's own queries ─────────────────────────────────────
export const getMyQueries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { studentId: req.user._id };
  if (status) filter.status = status;

  const result = await EnrollmentQuery.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 50),
    sort: { createdAt: -1 },
    populate: [
      { path: 'classroomId', select: 'title subject mode feesPaise thumbnailUrl' },
      { path: 'teacherId',   select: 'name avatarUrl' },
    ],
  });

  res.status(200).json(new ApiResponse(200, result, 'Your queries'));
});

// ── POST /enrollments/:enrollmentId/review ────────────────────────────────────
export const submitReview = asyncHandler(async (req, res) => {
  const { Review } = await import('../models/index.js');
  const { enrollmentId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw ApiError.badRequest('rating must be between 1 and 5');
  }

  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment || enrollment.studentId.toString() !== req.user._id.toString()) {
    throw ApiError.notFound('Enrollment');
  }
  if (enrollment.status !== 'completed') {
    throw ApiError.badRequest('You can only review completed classrooms');
  }
  if (enrollment.reviewId) {
    throw new ApiError(409, 'You have already reviewed this classroom', [], 'REVIEW_EXISTS');
  }

  const review = await Review.create({
    enrollmentId,
    studentId:   req.user._id,
    teacherId:   enrollment.teacherId,
    classroomId: enrollment.classroomId,
    rating,
    comment:     comment?.trim() || '',
  });

  await Enrollment.findByIdAndUpdate(enrollmentId, { reviewId: review._id });
  await Review.updateStats(enrollment.teacherId, enrollment.classroomId);

  res.status(201).json(new ApiResponse(201, review, 'Review submitted'));
});