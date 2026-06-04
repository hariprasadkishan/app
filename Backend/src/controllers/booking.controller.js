// src/controllers/booking.controller.js
import mongoose from "mongoose";
import { Booking, TeacherProfile, User, Payment } from "../models/index.js";
import { PaymentService } from "../services/payment.service.js";
import { NotificationService } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { validateObjectId } from "../utils/objectId.util.js";
import { paginate } from "../utils/pagination.util.js";
import { BOOKING_STATUS, PAYMENT_STATUS } from "../constants/enums.js";
import logger from "../config/logger.config.js";

// ── POST /api/v1/bookings ─────────────────────────────────────────────────────
// Student creates a booking (PENDING state, awaiting payment)
export const createBooking = asyncHandler(async (req, res) => {
  const { teacherId, subject, classGrade, scheduledAt, durationMinutes, slotId, notes } = req.body;
  const studentId = req.user._id;

  const teacherObjId = validateObjectId(teacherId, "teacherId");

  // Block self-booking
  if (studentId.toString() === teacherId) {
    throw new ApiError(400, "You cannot book yourself", [], "SELF_BOOKING");
  }

  // Get teacher profile for rate
  const teacherProfile = await TeacherProfile.findOne({ userId: teacherObjId })
    .select("hourlyRatePaise isAvailable verificationStatus platformFeePercent")
    .lean();

  if (!teacherProfile) {
    throw new ApiError(404, "Teacher not found", [], "TEACHER_NOT_FOUND");
  }
  if (!teacherProfile.isAvailable) {
    throw new ApiError(409, "Teacher is not available for bookings", [], "TEACHER_UNAVAILABLE");
  }

  // Scheduling conflict check
  const scheduledDate = new Date(scheduledAt);
  const hasConflict = await Booking.hasConflict(teacherObjId, scheduledDate, durationMinutes);
  if (hasConflict) {
    throw new ApiError(409, "This time slot is already booked. Please choose another.", [], "SLOT_CONFLICT");
  }

  // Calculate amounts
  const hourlyRatePaise = teacherProfile.hourlyRatePaise;
  const durationHours = durationMinutes / 60;
  const totalAmountPaise = Math.round(hourlyRatePaise * durationHours);
  const platformFeePercent = 15;
  const commissionPaise = Math.round(totalAmountPaise * platformFeePercent / 100);
  const teacherPayoutPaise = totalAmountPaise - commissionPaise;

  // Create booking
  const booking = await Booking.create({
    studentId,
    teacherId: teacherObjId,
    subject,
    classGrade,
    scheduledAt: scheduledDate,
    durationMinutes,
    slotId: slotId || null,
    status: BOOKING_STATUS.PENDING,
    hourlyRatePaise,
    totalAmountPaise,
    platformFeePercent,
    commissionPaise,
    teacherPayoutPaise,
    cancellationPolicy: { freeCancelHours: 24, refundPercentage: 100, lateRefundPercent: 50 },
  });

  // Create Razorpay order
  let razorpayOrder = null;
  try {
    razorpayOrder = await PaymentService.createOrder({
      amountPaise: totalAmountPaise,
      receipt: `booking_${booking._id}`,
      notes: { bookingId: booking._id.toString(), studentId: studentId.toString(), teacherId },
    });

    // Create Payment record
    await Payment.create({
      bookingId: booking._id,
      studentId,
      teacherId: teacherObjId,
      razorpayOrderId: razorpayOrder.id,
      totalAmountPaise,
      commissionPaise,
      teacherPayoutPaise,
      status: PAYMENT_STATUS.CREATED,
    });
  } catch (paymentErr) {
    // Payment gateway unavailable — proceed without order (cash-equivalent / manual later)
    logger.warn("Payment order creation failed, booking created without order", {
      bookingId: booking._id, error: paymentErr.message,
    });
  }

  logger.info("Booking created", { bookingId: booking._id, studentId, teacherId, correlationId: req.correlationId });

  // Update teacher stats
  await TeacherProfile.findOneAndUpdate(
    { userId: teacherObjId },
    { $inc: { "stats.totalBookings": 1 } }
  );

  res.status(201).json(
    new ApiResponse(201, {
      booking,
      razorpayOrderId: razorpayOrder?.id || null,
      totalAmountRupees: totalAmountPaise / 100,
      currency: "INR",
    }, "Booking created successfully")
  );
});

// ── GET /api/v1/bookings/:bookingId ───────────────────────────────────────────
export const getBooking = asyncHandler(async (req, res) => {
  const bookingId = validateObjectId(req.params.bookingId, "bookingId");

  const booking = await Booking.findById(bookingId)
    .populate("studentId", "name avatarUrl phone")
    .populate("teacherId", "name avatarUrl phone")
    .lean({ virtuals: true });

  if (!booking) {
    throw new ApiError(404, "Booking not found", [], "BOOKING_NOT_FOUND");
  }

  // Ownership: student, teacher, or admin
  const userId = req.user._id.toString();
  const isStudent = booking.studentId?._id?.toString() === userId;
  const isTeacher = booking.teacherId?._id?.toString() === userId;
  const isAdmin = req.user.role === "admin";

  if (!isStudent && !isTeacher && !isAdmin) {
    throw new ApiError(403, "Access denied", [], "FORBIDDEN");
  }

  res.status(200).json(new ApiResponse(200, { booking }, "Booking fetched"));
});

// ── PATCH /api/v1/bookings/:bookingId/confirm ─────────────────────────────────
// Teacher accepts a booking
export const confirmBooking = asyncHandler(async (req, res) => {
  const bookingId = validateObjectId(req.params.bookingId, "bookingId");

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", [], "BOOKING_NOT_FOUND");
  }

  if (booking.teacherId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the assigned teacher can confirm this booking", [], "FORBIDDEN");
  }

  if (!booking.canTransitionTo(BOOKING_STATUS.CONFIRMED)) {
    throw new ApiError(400, `Cannot confirm a booking in '${booking.status}' state`, [], "INVALID_TRANSITION");
  }

  booking.status = BOOKING_STATUS.CONFIRMED;
  await booking.save();

  // Notify student
  const [student, teacher] = await Promise.all([
    User.findById(booking.studentId).select("name phone").lean(),
    User.findById(booking.teacherId).select("name phone").lean(),
  ]);

  await NotificationService.notifyBookingConfirmed(booking, student, teacher).catch(() => {});

  res.status(200).json(new ApiResponse(200, { booking }, "Booking confirmed"));
});

// ── PATCH /api/v1/bookings/:bookingId/cancel ──────────────────────────────────
export const cancelBooking = asyncHandler(async (req, res) => {
  const bookingId = validateObjectId(req.params.bookingId, "bookingId");
  const { reason } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", [], "BOOKING_NOT_FOUND");
  }

  const userId = req.user._id.toString();
  const isStudent = booking.studentId.toString() === userId;
  const isTeacher = booking.teacherId.toString() === userId;
  const isAdmin = req.user.role === "admin";

  if (!isStudent && !isTeacher && !isAdmin) {
    throw new ApiError(403, "Access denied", [], "FORBIDDEN");
  }

  if (!booking.canTransitionTo(BOOKING_STATUS.CANCELLED)) {
    throw new ApiError(400, `Cannot cancel a booking in '${booking.status}' state`, [], "INVALID_TRANSITION");
  }

  await booking.transitionTo(BOOKING_STATUS.CANCELLED, req.user._id, reason || "Cancelled by user");

  // Release the slot
  if (booking.slotId) {
    await TeacherProfile.findOneAndUpdate(
      { userId: booking.teacherId, "availableSlots._id": booking.slotId },
      { $set: { "availableSlots.$.isBooked": false, "availableSlots.$.bookedBy": null } }
    );
  }

  const [student, teacher] = await Promise.all([
    User.findById(booking.studentId).select("name phone").lean(),
    User.findById(booking.teacherId).select("name phone").lean(),
  ]);

  const role = isStudent ? "student" : isTeacher ? "teacher" : "admin";
  await NotificationService.notifyBookingCancelled(booking, role, student, teacher).catch(() => {});

  logger.info("Booking cancelled", { bookingId: booking._id, cancelledBy: userId, reason });

  res.status(200).json(new ApiResponse(200, { booking }, "Booking cancelled"));
});

// ── PATCH /api/v1/bookings/:bookingId/start ───────────────────────────────────
export const startSession = asyncHandler(async (req, res) => {
  const bookingId = validateObjectId(req.params.bookingId, "bookingId");

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", [], "BOOKING_NOT_FOUND");
  }

  if (booking.teacherId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the teacher can start the session", [], "FORBIDDEN");
  }

  await booking.startSession();

  res.status(200).json(new ApiResponse(200, { booking }, "Session started"));
});

// ── PATCH /api/v1/bookings/:bookingId/end ─────────────────────────────────────
export const endSession = asyncHandler(async (req, res) => {
  const bookingId = validateObjectId(req.params.bookingId, "bookingId");

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", [], "BOOKING_NOT_FOUND");
  }

  if (booking.teacherId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Only the teacher can end the session", [], "FORBIDDEN");
  }

  await booking.endSession();

  // Update teacher stats
  await TeacherProfile.findOneAndUpdate(
    { userId: booking.teacherId },
    { $inc: { "stats.completedSessions": 1, "stats.totalEarningsPaise": booking.teacherPayoutPaise } }
  );

  logger.info("Session ended", { bookingId: booking._id, actualDuration: booking.actualDurationMinutes });

  res.status(200).json(new ApiResponse(200, { booking }, "Session ended"));
});