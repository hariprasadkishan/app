// ─────────────────────────────────────────────────────────────────────────────
// src/models/Booking.model.js
//
// Architecture decisions:
//  • Booking is the central entity — Payment, Refund, and Payout all ref it.
//  • Strict state-machine via BOOKING_STATUS — transitions enforced in service.
//  • Amounts denormalised (hourlyRate snapshot) to survive rate changes.
//  • slotId refs TeacherProfile.availableSlots subdoc — released on cancel.
//  • sessionStartedAt / sessionEndedAt enable real billing (actual duration).
//  • cancellationPolicy stored as snapshot at booking time — editable by admin
//    without affecting existing bookings.
//  • joinToken is a short-lived room token for future WebSocket/video room.
//  • platformFeePercent snapshot ensures correct commission even if policy
//    changes after booking is created.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose                  from 'mongoose';
import mongoosePaginate          from 'mongoose-paginate-v2';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals      from 'mongoose-lean-virtuals';

import { BOOKING_STATUS, SUBJECTS, CLASS_GRADES } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  auditSchema,
  defaultPaginateOptions,
}                                                  from '../utils/schema.utils.js';

const { Schema } = mongoose;

// ── Cancellation Policy sub-document (snapshot at booking time) ───────────────
const cancellationPolicySchema = new Schema(
  {
    freeCancelHours:     { type: Number, default: 24 },    // free cancel window
    refundPercentage:    { type: Number, default: 100 },   // % refund within window
    lateRefundPercent:   { type: Number, default: 50 },    // % refund outside window
  },
  { _id: false },
);

// ── Main Booking schema ───────────────────────────────────────────────────────

const bookingSchema = new Schema(
  {
    // ── Parties ───────────────────────────────────────────────────────────────
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

    // ── Session details ───────────────────────────────────────────────────────
    subject: {
      type:     String,
      enum:     { values: SUBJECTS, message: '{VALUE} is not a valid subject' },
      required: [true, 'Subject is required'],
    },
    classGrade: {
      type: String,
      enum: { values: CLASS_GRADES, message: '{VALUE} is not a valid class grade' },
    },
    scheduledAt:     { type: Date, required: [true, 'Scheduled time is required'], index: true },
    durationMinutes: { type: Number, required: true, enum: [30, 60, 90, 120] },

    // Slot reference — used to release availability on cancel
    slotId:          { type: Schema.Types.ObjectId, default: null },

    // ── Status (state machine) ────────────────────────────────────────────────
    status: enumField(BOOKING_STATUS, BOOKING_STATUS.PENDING),

    // ── Session runtime ───────────────────────────────────────────────────────
    sessionStartedAt: { type: Date, default: null },
    sessionEndedAt:   { type: Date, default: null },
    actualDurationMinutes: { type: Number, default: null },

    // ── Amounts (all in paise — snapshot at booking creation time) ────────────
    hourlyRatePaise:      { ...moneyField({ required: true }) },  // rate at time of booking
    totalAmountPaise:     { ...moneyField({ required: true }) },  // what student paid
    platformFeePercent:   { type: Number, default: 15, min: 0, max: 100 },
    commissionPaise:      { ...moneyField() },                    // platform fee
    teacherPayoutPaise:   { ...moneyField() },                    // what teacher gets

    // ── Payment reference (set after payment captured) ────────────────────────
    paymentId: {
      type:    Schema.Types.ObjectId,
      ref:     'Payment',
      default: null,
      index:   true,
    },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancelledBy:       { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason:{ type: String, trim: true, default: null },
    cancelledAt:       { type: Date, default: null },
    cancellationPolicy:{ type: cancellationPolicySchema, default: () => ({}) },

    // ── Video/WebSocket room (future) ─────────────────────────────────────────
    roomId:     { type: String, trim: true, default: null, unique: true, sparse: true },
    joinToken:  { type: String, trim: true, default: null, select: false },

    // ── Admin audit ───────────────────────────────────────────────────────────
    audit: { type: auditSchema, default: () => ({}) },

    // ── Future: Review ────────────────────────────────────────────────────────
    reviewId:   { type: Schema.Types.ObjectId, ref: 'Review', default: null },

    // ── Internal notes ────────────────────────────────────────────────────────
    internalNotes: { type: String, trim: true, default: null, select: false },
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

bookingSchema.plugin(mongoosePaginate);
bookingSchema.plugin(mongooseAggregatePaginate);
bookingSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

bookingSchema.index({ studentId: 1, status: 1, scheduledAt: -1 });    // student dashboard
bookingSchema.index({ teacherId: 1, status: 1, scheduledAt: -1 });    // teacher dashboard
bookingSchema.index({ teacherId: 1, scheduledAt: 1, status: 1 });     // conflict check
bookingSchema.index({ status: 1, scheduledAt: 1 });                    // cron jobs
bookingSchema.index({ status: 1, createdAt: -1 });                     // admin view
bookingSchema.index({ paymentId: 1 }, { sparse: true });

// Conflict check: is teacher free at this time?
bookingSchema.index(
  { teacherId: 1, scheduledAt: 1 },
  { partialFilterExpression: { status: { $in: ['confirmed', 'in_progress'] } } },
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

bookingSchema.virtual('scheduledEndAt').get(function () {
  if (!this.scheduledAt) return null;
  return new Date(this.scheduledAt.getTime() + this.durationMinutes * 60 * 1000);
});

bookingSchema.virtual('totalAmountRupees').get(function () {
  return this.totalAmountPaise / 100;
});

bookingSchema.virtual('isUpcoming').get(function () {
  return this.scheduledAt > new Date() &&
    [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(this.status);
});

bookingSchema.virtual('isPast').get(function () {
  return this.status === BOOKING_STATUS.COMPLETED;
});

// ── Instance methods ─────────────────────────────────────────────────────────

/**
 * Valid state transitions map — enforced in service layer.
 * Centralised here so transitions are visible / auditable in one place.
 */
const VALID_TRANSITIONS = {
  [BOOKING_STATUS.PENDING]:     [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]:   [BOOKING_STATUS.IN_PROGRESS, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.IN_PROGRESS]: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.DISPUTED],
  [BOOKING_STATUS.COMPLETED]:   [BOOKING_STATUS.REFUNDED],
  [BOOKING_STATUS.DISPUTED]:    [BOOKING_STATUS.REFUNDED, BOOKING_STATUS.COMPLETED],
};

bookingSchema.methods.canTransitionTo = function (newStatus) {
  const allowed = VALID_TRANSITIONS[this.status] || [];
  return allowed.includes(newStatus);
};

bookingSchema.methods.transitionTo = async function (newStatus, actorId, reason = '') {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Invalid transition: ${this.status} → ${newStatus}`);
  }
  this.status = newStatus;
  if (newStatus === BOOKING_STATUS.CANCELLED) {
    this.cancelledBy        = actorId;
    this.cancellationReason = reason;
    this.cancelledAt        = new Date();
  }
  return this.save();
};

bookingSchema.methods.computeAmounts = function (platformFeePercent = 15) {
  this.platformFeePercent = platformFeePercent;
  this.commissionPaise    = Math.round(this.totalAmountPaise * platformFeePercent / 100);
  this.teacherPayoutPaise = this.totalAmountPaise - this.commissionPaise;
  return this;
};

bookingSchema.methods.startSession = async function () {
  if (this.status !== BOOKING_STATUS.CONFIRMED) {
    throw new Error('Session can only start from CONFIRMED state');
  }
  this.status            = BOOKING_STATUS.IN_PROGRESS;
  this.sessionStartedAt  = new Date();
  return this.save();
};

bookingSchema.methods.endSession = async function () {
  if (this.status !== BOOKING_STATUS.IN_PROGRESS) {
    throw new Error('Session can only end from IN_PROGRESS state');
  }
  const now = new Date();
  this.status              = BOOKING_STATUS.COMPLETED;
  this.sessionEndedAt      = now;
  this.actualDurationMinutes = Math.round(
    (now - this.sessionStartedAt) / 60000,
  );
  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Check for scheduling conflicts for a teacher.
 */
bookingSchema.statics.hasConflict = async function (teacherId, scheduledAt, durationMinutes) {
  const sessionEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);
  const conflict = await this.findOne({
    teacherId,
    // Critical protection: block slots even if another check-out is in PENDING state
    status:      { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] },
    scheduledAt: { $lt: sessionEnd },
    $expr: {
      $gt: [
        { $add: ['$scheduledAt', { $multiply: ['$durationMinutes', 60000] }] },
        scheduledAt,
      ],
    },
  }).lean();
  return !!conflict;
};

/**
 * Student booking history — paginated.
 */
bookingSchema.statics.studentHistory = function (studentId, options = {}) {
  return this.paginate(
    { studentId },
    {
      ...defaultPaginateOptions,
      sort:     { scheduledAt: -1 },
      populate: [{ path: 'teacherId', select: 'name avatarUrl' }],
      ...options,
    },
  );
};

/**
 * Teacher booking history — paginated.
 */
bookingSchema.statics.teacherHistory = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId },
    {
      ...defaultPaginateOptions,
      sort:     { scheduledAt: -1 },
      populate: [{ path: 'studentId', select: 'name avatarUrl phone' }],
      ...options,
    },
  );
};

/**
 * Revenue analytics pipeline — used in admin dashboard.
 * Groups by date, calculates total GMV, commission, teacher payouts.
 */
bookingSchema.statics.revenueAnalytics = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status:    BOOKING_STATUS.COMPLETED,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id:              { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        gmvPaise:         { $sum: '$totalAmountPaise' },
        commissionPaise:  { $sum: '$commissionPaise' },
        payoutPaise:      { $sum: '$teacherPayoutPaise' },
        bookingCount:     { $sum: 1 },
      },
    },
    {
      $addFields: {
        gmvRupees:         { $divide: ['$gmvPaise',        100] },
        commissionRupees:  { $divide: ['$commissionPaise', 100] },
        payoutRupees:      { $divide: ['$payoutPaise',     100] },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Cron target: confirmed bookings that are overdue (session didn't start).
 */
bookingSchema.statics.overdueBookings = function (thresholdMinutes = 30) {
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  return this.find({
    status:      BOOKING_STATUS.CONFIRMED,
    scheduledAt: { $lt: threshold },
  }).lean();
};

/**
 * Aggregate: subject-wise booking counts for analytics dashboard.
 */
bookingSchema.statics.subjectBreakdown = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status:    { $ne: BOOKING_STATUS.CANCELLED },
      },
    },
    {
      $group: {
        _id:   '$subject',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmountPaise' },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// ── Query helpers ─────────────────────────────────────────────────────────────

bookingSchema.query.upcoming = function () {
  return this.where({ scheduledAt: { $gt: new Date() } });
};

bookingSchema.query.byStatus = function (status) {
  return this.where({ status });
};

// ─────────────────────────────────────────────────────────────────────────────
export const Booking = mongoose.model('Booking', bookingSchema);
export { VALID_TRANSITIONS };