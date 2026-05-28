// ─────────────────────────────────────────────────────────────────────────────
// src/models/RefundRequest.model.js
//
// Architecture decisions:
//  • Decoupled from Payment — refund request is a business workflow event,
//    the actual money movement happens in Payment.addRefund().
//  • evidenceUrls[] lets students upload proof (screenshots, recordings).
//  • requestedAmountPaise can differ from approvedAmountPaise for partial refunds.
//  • adminDecisionNote is mandatory when rejecting — enforced in instance method.
//  • SLA tracking via slaDeadline + resolvedAt enables admin KPI reporting.
//  • teacherNotified flag drives future notification cron job.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose              from 'mongoose';
import mongoosePaginate      from 'mongoose-paginate-v2';
import mongooseLeanVirtuals  from 'mongoose-lean-virtuals';

import { REFUND_STATUS, REFUND_REASON }   from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  auditSchema,
  urlValidator,
  defaultPaginateOptions,
}                                          from '../utils/schema.utils.js';

const { Schema } = mongoose;

// ── Default SLA: refund requests must be resolved within 3 business days ──────
const SLA_HOURS = 72;

const refundRequestSchema = new Schema(
  {
    // ── References ────────────────────────────────────────────────────────────
    bookingId: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: [true, 'Booking ID is required'],
      index:    true,
    },
    paymentId: {
      type:     Schema.Types.ObjectId,
      ref:      'Payment',
      required: [true, 'Payment ID is required'],
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
      required: true,
      index:    true,
    },

    // ── Request details ───────────────────────────────────────────────────────
    reason: enumField(REFUND_REASON, REFUND_REASON.OTHER),
    reasonDescription: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default:   '',
    },
    evidenceUrls: {
      type:    [String],
      validate: {
        validator: (arr) => arr.length <= 5 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:  'Max 5 evidence URLs, all must be valid',
      },
      default: [],
    },

    // ── Amounts ───────────────────────────────────────────────────────────────
    requestedAmountPaise: { ...moneyField({ required: true }) },
    approvedAmountPaise:  { ...moneyField() },   // set by admin on approval

    // ── Status ────────────────────────────────────────────────────────────────
    status: enumField(REFUND_STATUS, REFUND_STATUS.REQUESTED),

    // ── Admin decision ────────────────────────────────────────────────────────
    adminDecisionNote: { type: String, trim: true, default: null },
    resolvedAt:        { type: Date,   default: null, index: true },

    // ── SLA tracking ──────────────────────────────────────────────────────────
    slaDeadline: {
      type:    Date,
      default: () => new Date(Date.now() + SLA_HOURS * 3600000),
      index:   true,
    },

    // ── Notification flags (used by notification cron) ────────────────────────
    studentNotified: { type: Boolean, default: false },
    teacherNotified: { type: Boolean, default: false },

    // ── Razorpay refund tracking ───────────────────────────────────────────────
    razorpayRefundId: { type: String, trim: true, default: null, sparse: true, index: true },

    // ── Full audit trail ──────────────────────────────────────────────────────
    audit: { type: auditSchema, default: () => ({}) },
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

refundRequestSchema.plugin(mongoosePaginate);
refundRequestSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

refundRequestSchema.index({ status: 1, createdAt: -1 });               // admin queue
refundRequestSchema.index({ studentId: 1, status: 1, createdAt: -1 }); // student history
refundRequestSchema.index({ teacherId: 1, status: 1 });
refundRequestSchema.index({ slaDeadline: 1, status: 1 });              // SLA breach alerts

// Prevent duplicate refund requests for the same booking
refundRequestSchema.index(
  { bookingId: 1 },
  {
    unique:                true,
    partialFilterExpression: {
      status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] },
    },
  },
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

refundRequestSchema.virtual('requestedAmountRupees').get(function () {
  return this.requestedAmountPaise / 100;
});

refundRequestSchema.virtual('approvedAmountRupees').get(function () {
  return this.approvedAmountPaise / 100;
});

refundRequestSchema.virtual('isSlaBreached').get(function () {
  return !this.resolvedAt && this.slaDeadline < new Date();
});

refundRequestSchema.virtual('isResolved').get(function () {
  return [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED, REFUND_STATUS.PROCESSED].includes(
    this.status,
  );
});

refundRequestSchema.virtual('resolutionTimeHours').get(function () {
  if (!this.resolvedAt) return null;
  return Math.round((this.resolvedAt - this.createdAt) / 3600000);
});

// ── Instance methods ─────────────────────────────────────────────────────────

refundRequestSchema.methods.approve = async function ({
  adminId,
  approvedAmountPaise,
  note = '',
  razorpayRefundId = null,
}) {
  if (this.status !== REFUND_STATUS.UNDER_REVIEW && this.status !== REFUND_STATUS.REQUESTED) {
    throw new Error(`Cannot approve refund in status: ${this.status}`);
  }
  this.status               = REFUND_STATUS.APPROVED;
  this.approvedAmountPaise  = approvedAmountPaise ?? this.requestedAmountPaise;
  this.adminDecisionNote    = note;
  this.razorpayRefundId     = razorpayRefundId;
  this.resolvedAt           = new Date();
  this.audit.reviewedBy     = adminId;
  this.audit.reviewedAt     = new Date();
  this.audit.adminAction    = 'approved';
  this.audit.reviewNote     = note;
  return this.save();
};

refundRequestSchema.methods.reject = async function ({ adminId, reason }) {
  if (!reason?.trim()) throw new Error('Rejection reason is mandatory');
  this.status            = REFUND_STATUS.REJECTED;
  this.adminDecisionNote = reason;
  this.resolvedAt        = new Date();
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'rejected';
  this.audit.reviewNote  = reason;
  return this.save();
};

refundRequestSchema.methods.markUnderReview = async function (adminId) {
  this.status           = REFUND_STATUS.UNDER_REVIEW;
  this.audit.reviewedBy = adminId;
  this.audit.reviewedAt = new Date();
  this.audit.adminAction= 'assigned';
  return this.save();
};

refundRequestSchema.methods.markProcessed = async function (razorpayRefundId) {
  this.status           = REFUND_STATUS.PROCESSED;
  this.razorpayRefundId = razorpayRefundId;
  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Admin: pending refund queue (FIFO).
 */
refundRequestSchema.statics.pendingQueue = function (options = {}) {
  return this.paginate(
    { status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] } },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: 1 },
      populate: [
        { path: 'studentId', select: 'name phone' },
        { path: 'bookingId', select: 'subject scheduledAt totalAmountPaise' },
      ],
      ...options,
    },
  );
};

/**
 * SLA breach report: unresolved refunds past deadline.
 */
refundRequestSchema.statics.slaBreaches = function () {
  return this.find({
    slaDeadline: { $lt: new Date() },
    resolvedAt:  null,
  })
    .sort({ slaDeadline: 1 })
    .lean();
};

/**
 * Refund analytics: count & amount by reason.
 */
refundRequestSchema.statics.refundAnalytics = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status:    { $in: [REFUND_STATUS.APPROVED, REFUND_STATUS.PROCESSED] },
      },
    },
    {
      $group: {
        _id:         '$reason',
        count:       { $sum: 1 },
        totalPaise:  { $sum: '$approvedAmountPaise' },
      },
    },
    {
      $addFields: { totalRupees: { $divide: ['$totalPaise', 100] } },
    },
    { $sort: { count: -1 } },
  ]);
};

// ── Query helpers ─────────────────────────────────────────────────────────────

refundRequestSchema.query.pending = function () {
  return this.where({
    status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] },
  });
};

refundRequestSchema.query.resolved = function () {
  return this.where({
    status: { $in: [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED, REFUND_STATUS.PROCESSED] },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
export const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);