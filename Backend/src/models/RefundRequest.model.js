// ─────────────────────────────────────────────────────────────────────────────
// src/models/RefundRequest.model.js
//
// Covers two scenarios:
//   A) Student's token-purchase refund request (edge cases, disputes)
//   B) Enrollment fee refund — triggered automatically or by student complaint
//      when teacher abandons course (Case 2 / Case 3).
//
// For Case 2 (teacher leaves before 50% hours): full 100% refund to student.
// For Case 3 (teacher leaves after 50% hours): pro-rata refund.
// Admin handles the case determination and triggers payout computation.
//
// SLA: admin must resolve within 72 hours.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { REFUND_STATUS, REFUND_REASON, COMPLETION_CASE } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  auditSchema,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

const SLA_HOURS = 72;

const refundRequestSchema = new Schema(
  {
    // ── References ─────────────────────────────────────────────────────────────
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
    classroomId: {
      type:     Schema.Types.ObjectId,
      ref:      'Classroom',
      default:  null,
      index:    true,
    },
    enrollmentId: {
      type:     Schema.Types.ObjectId,
      ref:      'Enrollment',
      default:  null,
      index:    true,
    },
    paymentId: {
      type:     Schema.Types.ObjectId,
      ref:      'Payment',
      required: [true, 'Payment ID is required'],
      index:    true,
    },
    // ── Request details ────────────────────────────────────────────────────────
    reason: enumField(REFUND_REASON, REFUND_REASON.OTHER),
    reasonDescription: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default:   '',
    },
    // Evidence (screenshots, recordings, etc.)
    evidenceUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 5 evidence URLs, all must be valid',
      },
    },
    // ── Amounts ────────────────────────────────────────────────────────────────
    requestedAmountPaise: { ...moneyField({ required: true }) },
    approvedAmountPaise:  { ...moneyField() },
    // ── Status ─────────────────────────────────────────────────────────────────
    status: enumField(REFUND_STATUS, REFUND_STATUS.REQUESTED),
    // ── Completion case context (set by admin when processing course abandonment) ──
    // Determines the refund math applied
    completionCase: {
      type:    String,
      enum:    [...Object.values(COMPLETION_CASE), null],
      default: null,
    },
    // Snapshot: hours conducted at time of abandonment (for Case 3 math)
    hoursConductedAtAbandonment: { type: Number, default: null },
    hoursPlannedTotal:           { type: Number, default: null },
    // ── Admin decision ─────────────────────────────────────────────────────────
    adminDecisionNote: { type: String, trim: true, default: null },
    resolvedAt:        { type: Date,   default: null, index: true },
    // ── SLA tracking ───────────────────────────────────────────────────────────
    slaDeadline: {
      type:    Date,
      default: () => new Date(Date.now() + SLA_HOURS * 3600000),
      index:   true,
    },
    // ── Notification flags ─────────────────────────────────────────────────────
    studentNotified: { type: Boolean, default: false },
    teacherNotified: { type: Boolean, default: false },
    // ── Razorpay refund tracking ───────────────────────────────────────────────
    razorpayRefundId: {
      type:   String,
      trim:   true,
      default: null,
      sparse: true,
      index:  true,
    },
    // ── Audit ──────────────────────────────────────────────────────────────────
    audit: { type: auditSchema, default: () => ({}) },
    // ── Auto-generated flag (system triggered vs student-raised) ──────────────
    isSystemGenerated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

refundRequestSchema.plugin(mongoosePaginate);
refundRequestSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ───────────────────────────────────────────────────────────────────
refundRequestSchema.index({ status: 1, createdAt: -1 });
refundRequestSchema.index({ studentId: 1, status: 1, createdAt: -1 });
refundRequestSchema.index({ teacherId: 1, status: 1 });
refundRequestSchema.index({ classroomId: 1, status: 1 });
refundRequestSchema.index({ slaDeadline: 1, status: 1 });
// Prevent duplicate active refund request per enrollment
refundRequestSchema.index(
  { enrollmentId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      status: { $in: ['requested', 'under_review'] },
      enrollmentId: { $ne: null },
    },
  },
);

// ── Virtuals ───────────────────────────────────────────────────────────────────
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

// ── Instance methods ──────────────────────────────────────────────────────────
refundRequestSchema.methods.approve = async function ({
  adminId,
  approvedAmountPaise,
  note = '',
  razorpayRefundId = null,
  completionCase = null,
}) {
  if (![REFUND_STATUS.UNDER_REVIEW, REFUND_STATUS.REQUESTED].includes(this.status)) {
    throw new Error(`Cannot approve refund in status: ${this.status}`);
  }
  this.status              = REFUND_STATUS.APPROVED;
  this.approvedAmountPaise = approvedAmountPaise ?? this.requestedAmountPaise;
  this.adminDecisionNote   = note;
  this.razorpayRefundId    = razorpayRefundId;
  this.resolvedAt          = new Date();
  this.completionCase      = completionCase ?? this.completionCase;
  this.audit.reviewedBy    = adminId;
  this.audit.reviewedAt    = new Date();
  this.audit.adminAction   = 'approved';
  this.audit.reviewNote    = note;
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
  this.status            = REFUND_STATUS.UNDER_REVIEW;
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'assigned';
  return this.save();
};

refundRequestSchema.methods.markProcessed = async function (razorpayRefundId) {
  this.status           = REFUND_STATUS.PROCESSED;
  this.razorpayRefundId = razorpayRefundId;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
refundRequestSchema.statics.pendingQueue = function (options = {}) {
  return this.paginate(
    { status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] } },
    {
      ...defaultPaginateOptions,
      sort: { createdAt: 1 },
      populate: [
        { path: 'studentId',   select: 'name phone' },
        { path: 'classroomId', select: 'title subject' },
        { path: 'paymentId',   select: 'totalAmountPaise purpose' },
      ],
      ...options,
    },
  );
};

refundRequestSchema.statics.slaBreaches = function () {
  return this.find({
    slaDeadline: { $lt: new Date() },
    resolvedAt:  null,
  })
    .sort({ slaDeadline: 1 })
    .lean();
};

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
        _id:        '$reason',
        count:      { $sum: 1 },
        totalPaise: { $sum: '$approvedAmountPaise' },
      },
    },
    { $addFields: { totalRupees: { $divide: ['$totalPaise', 100] } } },
    { $sort: { count: -1 } },
  ]);
};

refundRequestSchema.query.pending = function () {
  return this.where({ status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] } });
};
refundRequestSchema.query.resolved = function () {
  return this.where({
    status: { $in: [REFUND_STATUS.APPROVED, REFUND_STATUS.REJECTED, REFUND_STATUS.PROCESSED] },
  });
};

export const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);