// ─────────────────────────────────────────────────────────────────────────────
// src/models/Review.model.js
//
// Architecture decisions:
//  • One Review per booking — unique index on bookingId prevents duplicates.
//  • Booking must be COMPLETED before review is allowed (enforced in service).
//  • rating is 1–5 integer; stored as Number for aggregation ($avg).
//  • Teacher profile avgRating + reviewCount are updated atomically via
//    static method updateTeacherStats() — called post-save in service layer.
//  • isVisible flag lets admin hide reviews without deleting (soft hide).
//  • adminNote stored select:false — never exposed to public endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

import {
  jsonTransform,
  toObjectOptions,
  defaultPaginateOptions,
}                            from '../utils/schema.utils.js';

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    bookingId: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: [true, 'Booking ID is required'],
      unique:   true,     // one review per booking
      index:    true,
    },
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Student ID is required'],
      index:    true,
    },
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    rating: {
      type:     Number,
      required: [true, 'Rating is required'],
      min:      [1, 'Rating must be at least 1'],
      max:      [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message:   'Rating must be a whole number',
      },
    },
    comment: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      default:   '',
    },

    // ── Moderation ────────────────────────────────────────────────────────────
    isVisible:  { type: Boolean, default: true, index: true },
    adminNote:  { type: String,  trim: true, default: null, select: false },
    reportedAt: { type: Date,    default: null },
    reportReason: { type: String, trim: true, default: null },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

reviewSchema.plugin(mongoosePaginate);
reviewSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

reviewSchema.index({ teacherId: 1, isVisible: 1, createdAt: -1 });   // public profile
reviewSchema.index({ studentId: 1, createdAt: -1 });                  // student history
reviewSchema.index({ rating:    1, teacherId:  1 });                  // analytics

// ── Virtuals ─────────────────────────────────────────────────────────────────

reviewSchema.virtual('ratingLabel').get(function () {
  const labels = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' };
  return labels[this.rating] || 'Unknown';
});

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Called after a review is created or updated.
 * Atomically recomputes and writes avgRating + reviewCount to TeacherProfile.
 */
reviewSchema.statics.updateTeacherStats = async function (teacherId) {
  const [stats] = await this.aggregate([
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), isVisible: true } },
    {
      $group: {
        _id:         null,
        avgRating:   { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const TeacherProfile = mongoose.model('TeacherProfile');
  await TeacherProfile.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(teacherId) },
    {
      $set: {
        'stats.avgRating':   stats ? Math.round(stats.avgRating * 10) / 10 : 0,
        'stats.reviewCount': stats ? stats.reviewCount : 0,
      },
    },
  );
};

/**
 * Paginated public reviews for a teacher profile.
 */
reviewSchema.statics.publicTeacherReviews = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId: new mongoose.Types.ObjectId(teacherId), isVisible: true },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: -1 },
      populate: { path: 'studentId', select: 'name avatarUrl' },
      select:   '-adminNote -reportReason',
      ...options,
    },
  );
};

/**
 * Rating distribution for a teacher (for the star-breakdown widget).
 */
reviewSchema.statics.ratingBreakdown = function (teacherId) {
  return this.aggregate([
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), isVisible: true } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
export const Review = mongoose.model('Review', reviewSchema);