// ─────────────────────────────────────────────────────────────────────────────
// src/models/Payout.model.js
//
// Architecture decisions:
//  • One Payout per payment — created when escrow is released post-session.
//  • stage field models the lifecycle: ESCROW_RELEASED → PAYOUT_INITIATED → SETTLED.
//  • bankDetails stored encrypted at app layer — only last4 + ifsc stored raw.
//  • razorpayPayoutId set when Razorpay Payouts API call is made.
//  • retryCount + lastFailureReason support automated retry logic in cron.
//  • onHold flag allows admin to freeze a payout without changing its status.
//  • Compound index (teacherId + status) drives the teacher earnings dashboard.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose                  from 'mongoose';
import mongoosePaginate          from 'mongoose-paginate-v2';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals      from 'mongoose-lean-virtuals';

import { PAYOUT_STATUS, PAYOUT_STAGE }  from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  auditSchema,
  defaultPaginateOptions,
}                                        from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Bank Account sub-document (snapshot at payout time) ──────────────────────
// Snapshot so historical payouts are accurate even if teacher updates bank details.
const bankAccountSnapshotSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountLast4:      { type: String, trim: true },  // last 4 digits only
    ifsc:              { type: String, trim: true, uppercase: true },
    bankName:          { type: String, trim: true },
    razorpayContactId: { type: String, trim: true, select: false },
    razorpayFundId:    { type: String, trim: true, select: false },
  },
  { _id: false },
);

// ── Main Payout schema ────────────────────────────────────────────────────────

const payoutSchema = new Schema(
  {
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },
    paymentId: {
      type:     Schema.Types.ObjectId,
      ref:      'Payment',
      required: [true, 'Payment ID is required'],
      unique:   true,   // one payout per payment
      index:    true,
    },
    bookingId: {
      type:  Schema.Types.ObjectId,
      ref:   'Booking',
      index: true,
    },

    // ── Amount ────────────────────────────────────────────────────────────────
    amountPaise: { ...moneyField({ required: [true, 'Payout amount is required'] }) },
    currency:    { type: String, default: 'INR', uppercase: true },

    // ── Stage & status ────────────────────────────────────────────────────────
    stage:  enumField(PAYOUT_STAGE,  PAYOUT_STAGE.ESCROW_RELEASED),
    status: enumField(PAYOUT_STATUS, PAYOUT_STATUS.QUEUED),

    // ── Razorpay Payout API fields ────────────────────────────────────────────
    razorpayPayoutId:  { type: String, trim: true, unique: true, sparse: true, index: true },
    razorpayFundAccountId: { type: String, trim: true, select: false },
    mode:              { type: String, enum: ['NEFT', 'IMPS', 'UPI', 'RTGS'], default: 'IMPS' },
    purpose:           { type: String, default: 'payout', trim: true },

    // ── Bank details snapshot ─────────────────────────────────────────────────
    bankAccount: { type: bankAccountSnapshotSchema, default: null },

    // ── Retry logic ───────────────────────────────────────────────────────────
    retryCount:         { type: Number, default: 0, min: 0, max: 5 },
    lastFailureReason:  { type: String, trim: true, default: null },
    nextRetryAt:        { type: Date,   default: null, index: true },

    // ── Admin control ─────────────────────────────────────────────────────────
    onHold:             { type: Boolean, default: false, index: true },
    onHoldReason:       { type: String,  trim: true, default: null },

    // ── Timeline ──────────────────────────────────────────────────────────────
    initiatedAt:   { type: Date, default: null },
    settledAt:     { type: Date, default: null },
    failedAt:      { type: Date, default: null },

    // ── Audit ─────────────────────────────────────────────────────────────────
    audit: { type: auditSchema, default: () => ({}) },

    // ── UTR / reference ───────────────────────────────────────────────────────
    utr: { type: String, trim: true, default: null },   // bank transaction ref
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

payoutSchema.plugin(mongoosePaginate);
payoutSchema.plugin(mongooseAggregatePaginate);
payoutSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

payoutSchema.index({ teacherId: 1, status: 1, createdAt: -1 });  // earnings history
payoutSchema.index({ status: 1, onHold: 1, nextRetryAt: 1 });    // cron payout queue
payoutSchema.index({ status: 1, createdAt: -1 });                 // admin view
payoutSchema.index({ settledAt: -1 }, { sparse: true });

// ── Virtuals ─────────────────────────────────────────────────────────────────

payoutSchema.virtual('amountRupees').get(function () {
  return this.amountPaise / 100;
});

payoutSchema.virtual('isSettled').get(function () {
  return this.status === PAYOUT_STATUS.COMPLETED;
});

payoutSchema.virtual('canRetry').get(function () {
  return this.status === PAYOUT_STATUS.FAILED && this.retryCount < 5 && !this.onHold;
});

// ── Instance methods ─────────────────────────────────────────────────────────

payoutSchema.methods.markInitiated = async function (razorpayPayoutId) {
  this.stage            = PAYOUT_STAGE.PAYOUT_INITIATED;
  this.status           = PAYOUT_STATUS.PROCESSING;
  this.razorpayPayoutId = razorpayPayoutId;
  this.initiatedAt      = new Date();
  return this.save();
};

payoutSchema.methods.markSettled = async function (utr) {
  this.stage     = PAYOUT_STAGE.PAYOUT_SETTLED;
  this.status    = PAYOUT_STATUS.COMPLETED;
  this.utr       = utr || null;
  this.settledAt = new Date();
  return this.save();
};

payoutSchema.methods.markFailed = async function (reason) {
  this.status            = PAYOUT_STATUS.FAILED;
  this.lastFailureReason = reason;
  this.failedAt          = new Date();
  this.retryCount        += 1;

  // Exponential backoff: 15min, 1hr, 4hr, 12hr, 24hr
  const backoffs = [15, 60, 240, 720, 1440];
  const delay    = backoffs[Math.min(this.retryCount - 1, backoffs.length - 1)];
  this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);

  return this.save();
};

payoutSchema.methods.putOnHold = async function (reason, adminId) {
  this.onHold             = true;
  this.onHoldReason       = reason;
  this.status             = PAYOUT_STATUS.ON_HOLD;
  this.audit.reviewedBy   = adminId;
  this.audit.reviewedAt   = new Date();
  this.audit.adminAction  = 'on_hold';
  return this.save();
};

payoutSchema.methods.releaseHold = async function (adminId) {
  this.onHold             = false;
  this.status             = PAYOUT_STATUS.QUEUED;
  this.audit.reviewedBy   = adminId;
  this.audit.reviewedAt   = new Date();
  this.audit.adminAction  = 'hold_released';
  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Cron job target: queued payouts that are not on hold, retry time elapsed.
 */
payoutSchema.statics.processingQueue = function (batchSize = 50) {
  return this.find({
    status: PAYOUT_STATUS.QUEUED,
    onHold: false,
    $or: [
      { nextRetryAt: null },
      { nextRetryAt: { $lte: new Date() } },
    ],
  })
    .limit(batchSize)
    .sort({ createdAt: 1 })
    .lean();
};

/**
 * Teacher earnings history — paginated.
 */
payoutSchema.statics.teacherEarnings = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: -1 },
      populate: { path: 'bookingId', select: 'subject scheduledAt durationMinutes' },
      ...options,
    },
  );
};

/**
 * Teacher lifetime earnings summary (for dashboard widget).
 */
payoutSchema.statics.earningsSummary = function (teacherId) {
  return this.aggregate([
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
    {
      $group: {
        _id:              '$status',
        totalPaise:       { $sum: '$amountPaise' },
        count:            { $sum: 1 },
      },
    },
    {
      $project: {
        status:       '$_id',
        totalRupees:  { $divide: ['$totalPaise', 100] },
        count:        1,
        _id:          0,
      },
    },
  ]);
};

/**
 * Admin payout report: total disbursed over a period.
 */
payoutSchema.statics.disbursementReport = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status:    PAYOUT_STATUS.COMPLETED,
        settledAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id:         { $dateToString: { format: '%Y-%m-%d', date: '$settledAt' } },
        totalPaise:  { $sum: '$amountPaise' },
        count:       { $sum: 1 },
      },
    },
    {
      $addFields: { totalRupees: { $divide: ['$totalPaise', 100] } },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ── Query helpers ─────────────────────────────────────────────────────────────

payoutSchema.query.settled = function () {
  return this.where({ status: PAYOUT_STATUS.COMPLETED });
};

payoutSchema.query.pending = function () {
  return this.where({ status: { $in: [PAYOUT_STATUS.QUEUED, PAYOUT_STATUS.PROCESSING] } });
};

// ─────────────────────────────────────────────────────────────────────────────
export const Payout = mongoose.model('Payout', payoutSchema);