// src/controllers/review.controller.js

import { Review, Booking, TeacherProfile } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { validateObjectId } from '../utils/objectId.util.js';
import { paginate } from '../utils/pagination.util.js';
import { BOOKING_STATUS } from '../constants/enums.js';
import logger from '../config/logger.config.js';

// ── POST /api/v1/reviews ──────────────────────────────────────────────────────
// Student creates a review after a completed booking
export const createReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  const studentId = req.user._id;

  const bookingObjId = validateObjectId(bookingId, 'bookingId');

  // Fetch booking and validate ownership + status
  const booking = await Booking.findById(bookingObjId).lean();
  if (!booking) {
    throw new ApiError(404, 'Booking not found', [], 'BOOKING_NOT_FOUND');
  }

  if (booking.studentId.toString() !== studentId.toString()) {
    throw new ApiError(403, 'You can only review your own bookings', [], 'FORBIDDEN');
  }

  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new ApiError(
      400,
      'You can only review completed sessions',
      [],
      'BOOKING_NOT_COMPLETED',
    );
  }

  // Idempotency — one review per booking
  const existing = await Review.findOne({ bookingId: bookingObjId }).lean();
  if (existing) {
    throw new ApiError(409, 'You have already reviewed this session', [], 'REVIEW_EXISTS');
  }

  const review = await Review.create({
    bookingId: bookingObjId,
    studentId,
    teacherId: booking.teacherId,
    rating:    Number(rating),
    comment:   comment?.trim() || '',
  });

  // Update Booking.reviewId reference
  await Booking.findByIdAndUpdate(bookingObjId, { reviewId: review._id });

  // Recompute teacher stats atomically
  await Review.updateTeacherStats(booking.teacherId).catch((err) => {
    logger.warn('Failed to update teacher stats after review', { err: err.message });
  });

  logger.info('Review created', {
    reviewId:  review._id,
    teacherId: booking.teacherId,
    studentId,
    rating,
    correlationId: req.correlationId,
  });

  res.status(201).json(new ApiResponse(201, { review }, 'Review submitted successfully'));
});

// ── GET /api/v1/reviews/teacher/:teacherId ────────────────────────────────────
// Public — paginated reviews for a teacher profile
export const getTeacherReviews = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, 'teacherId');
  const { page = 1, limit = 10 } = req.query;

  const [reviewsResult, breakdown] = await Promise.all([
    Review.publicTeacherReviews(teacherId, {
      page:  Number(page),
      limit: Math.min(Number(limit), 50),
    }),
    Review.ratingBreakdown(teacherId),
  ]);

  // Build distribution map { 5: 42, 4: 18, 3: 5, 2: 1, 1: 0 }
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  breakdown.forEach(({ _id, count }) => {
    if (_id >= 1 && _id <= 5) distribution[_id] = count;
  });

  res.status(200).json(
    new ApiResponse(
      200,
      { ...paginate(reviewsResult), distribution },
      'Reviews fetched',
    ),
  );
});

// ── GET /api/v1/reviews/me ────────────────────────────────────────────────────
// Student — reviews they have written
export const getMyReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await Review.paginate(
    { studentId: req.user._id },
    {
      page:  Number(page),
      limit: Math.min(Number(limit), 50),
      sort:  { createdAt: -1 },
      populate: [
        { path: 'teacherId', select: 'name avatarUrl' },
        { path: 'bookingId', select: 'subject scheduledAt' },
      ],
      lean:       true,
      leanWithId: true,
      customLabels: { docs: 'results', totalDocs: 'total', totalPages: 'pages' },
    },
  );

  res.status(200).json(new ApiResponse(200, paginate(result), 'Reviews fetched'));
});

// ── GET /api/v1/reviews/teacher-dashboard ────────────────────────────────────
// Authenticated teacher — reviews they have received (for dashboard)
export const getTeacherReceivedReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await Review.paginate(
    { teacherId: req.user._id, isVisible: true },
    {
      page:  Number(page),
      limit: Math.min(Number(limit), 50),
      sort:  { createdAt: -1 },
      populate: { path: 'studentId', select: 'name avatarUrl' },
      lean:       true,
      leanWithId: true,
      customLabels: { docs: 'results', totalDocs: 'total', totalPages: 'pages' },
    },
  );

  // Compute summary stats
  const profile = await TeacherProfile.findOne({ userId: req.user._id })
    .select('stats.avgRating stats.reviewCount')
    .lean();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ...paginate(result),
        summary: {
          avgRating:   profile?.stats?.avgRating || 0,
          reviewCount: profile?.stats?.reviewCount || 0,
        },
      },
      'Reviews fetched',
    ),
  );
});