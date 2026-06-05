// src/controllers/refund.controller.js
// Student-facing refund request endpoints.
// Admin-side handling lives in admin.controller.js.

import { RefundRequest, Booking, Payment } from '../models/index.js';
import { CloudinaryService } from '../services/cloudinary.service.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { validateObjectId } from '../utils/objectId.util.js';
import { paginate } from '../utils/pagination.util.js';
import { BOOKING_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../constants/enums.js';
import logger from '../config/logger.config.js';

// ── POST /api/v1/students/me/refund-requests ──────────────────────────────────
// Student submits a refund request for a booking
export const submitRefundRequest = asyncHandler(async (req, res) => {
  const { bookingId, reason, reasonDescription } = req.body;
  const studentId = req.user._id;

  const bookingObjId = validateObjectId(bookingId, 'bookingId');

  const booking = await Booking.findById(bookingObjId)
    .populate('paymentId')
    .lean();

  if (!booking) {
    throw new ApiError(404, 'Booking not found', [], 'BOOKING_NOT_FOUND');
  }

  // Ownership check
  if (booking.studentId.toString() !== studentId.toString()) {
    throw new ApiError(403, 'Access denied', [], 'FORBIDDEN');
  }

  // Only confirmed or completed bookings are eligible
  const eligibleStatuses = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED];
  if (!eligibleStatuses.includes(booking.status)) {
    throw new ApiError(
      400,
      `Refund not available for bookings in '${booking.status}' status`,
      [],
      'REFUND_NOT_ELIGIBLE',
    );
  }

  // Find the associated payment
  const payment = await Payment.findOne({
    bookingId:  bookingObjId,
    status:     PAYMENT_STATUS.CAPTURED,
  }).lean();

  if (!payment) {
    throw new ApiError(
      404,
      'No captured payment found for this booking',
      [],
      'PAYMENT_NOT_FOUND',
    );
  }

  // Prevent duplicate active refund requests for same booking
  const existingRequest = await RefundRequest.findOne({
    bookingId:  bookingObjId,
    status:     { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] },
  }).lean();

  if (existingRequest) {
    throw new ApiError(
      409,
      'A refund request for this booking is already under review',
      [],
      'REFUND_ALREADY_REQUESTED',
    );
  }

  // Compute refund amount based on cancellation policy
  const requestedAmountPaise = _computeRefundAmount(booking, payment);

  // Handle evidence uploads if files provided
  const evidenceUrls = [];
  if (req.files?.length > 0) {
    for (const file of req.files.slice(0, 5)) {
      const result = await CloudinaryService.uploadBuffer(file.buffer, {
        folder: 'trueed/refund-evidence',
        resource_type: 'auto',
      });
      evidenceUrls.push(result.secure_url);
    }
  }

  const refundRequest = await RefundRequest.create({
    bookingId:            bookingObjId,
    paymentId:            payment._id,
    studentId,
    teacherId:            booking.teacherId,
    reason,
    reasonDescription:    reasonDescription?.trim() || '',
    requestedAmountPaise,
    evidenceUrls,
    status:               REFUND_STATUS.REQUESTED,
  });

  logger.info('Refund request submitted', {
    refundId:  refundRequest._id,
    bookingId: bookingObjId,
    studentId,
    reason,
    correlationId: req.correlationId,
  });

  res.status(201).json(
    new ApiResponse(
      201,
      {
        refundRequestId:      refundRequest._id,
        requestedAmountPaise,
        requestedAmountRupees: requestedAmountPaise / 100,
        status:               REFUND_STATUS.REQUESTED,
        slaDeadline:          refundRequest.slaDeadline,
      },
      'Refund request submitted. Our team will review it within 72 hours.',
    ),
  );
});

// ── GET /api/v1/students/me/refund-requests ───────────────────────────────────
// Student fetches their refund request history
export const getMyRefundRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const filter = { studentId: req.user._id };
  if (status) filter.status = status;

  const result = await RefundRequest.paginate(filter, {
    page:  Number(page),
    limit: Math.min(Number(limit), 50),
    sort:  { createdAt: -1 },
    populate: [
      { path: 'bookingId', select: 'subject scheduledAt totalAmountPaise' },
    ],
    select:     '-adminNote',
    lean:       true,
    leanWithId: true,
    customLabels: { docs: 'results', totalDocs: 'total', totalPages: 'pages' },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), 'Refund requests fetched'));
});

// ── GET /api/v1/students/me/refund-requests/:refundId ────────────────────────
// Student fetches a single refund request
export const getRefundRequestById = asyncHandler(async (req, res) => {
  const refundId = validateObjectId(req.params.refundId, 'refundId');

  const refundRequest = await RefundRequest.findById(refundId)
    .populate('bookingId', 'subject scheduledAt totalAmountPaise')
    .select('-adminNote')
    .lean({ virtuals: true });

  if (!refundRequest) {
    throw new ApiError(404, 'Refund request not found', [], 'REFUND_NOT_FOUND');
  }

  // Ownership check
  if (refundRequest.studentId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Access denied', [], 'FORBIDDEN');
  }

  res.status(200).json(new ApiResponse(200, { refundRequest }, 'Refund request fetched'));
});

// ── Internal helpers ──────────────────────────────────────────────────────────

function _computeRefundAmount(booking, payment) {
  const policy = booking.cancellationPolicy || {};
  const freeCancelHours = policy.freeCancelHours ?? 24;
  const refundPct = policy.refundPercentage ?? 100;
  const lateRefundPct = policy.lateRefundPercent ?? 50;

  const hoursUntilSession =
    (new Date(booking.scheduledAt) - Date.now()) / 3_600_000;

  const pct = hoursUntilSession >= freeCancelHours ? refundPct : lateRefundPct;
  return Math.round((payment.totalAmountPaise * pct) / 100);
}