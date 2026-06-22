// ─────────────────────────────────────────────────────────────────────────────
// src/models/Payout.model.js
//
// Created per classroom completion per enrollment batch.
// Amount computed by CompletionService based on COMPLETION_CASE.
// Teacher also has a wallet (walletPaise on TeacherProfile) for accumulated earnings.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose                  from 'mongoose';
import mongoosePaginate          from 'mongoose-paginate-v2';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals      from 'mongoose-lean-virtuals';
import { PAYOUT_STATUS, PAYOUT_STAGE, COMPLETION_CASE } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  auditSchema,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Bank snapshot sub-doc ─────────────────────────────────────────────────────
const bankSnapshotSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountLast4:      { type: String, trim: true },
    ifsc:              { type: String, trim: true, uppercase: true },
    bankName:          { type: String, trim: true },
    razorpayContactId: { type: String, trim: true, select: false },
    razorpayFundId:    { type: String, trim: true, select: false },
  },
  { _id: false },
);

const payoutSchema = new Schema(
  {
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },
    classroomId: {
      type:     Schema.Types.ObjectId,
      ref:      'Classroom',
      required: [true, 'Classroom ID is required'],
      index:    true,
    },
    // Batch of enrollment payments this payout covers
    enrollmentIds: [{ type: Schema.Types.ObjectId, ref: 'Enrollment' }],
    // ── Completion context ────────────────────────────────────────────────────
    completionCase: enumField(COMPLETION_CASE, COMPLETION_CASE.CASE_1),
    // ── Amounts ───────────────────────────────────────────────────────────────
    // Total enrollment fees collected from all students
    grossFeesCollectedPaise:  { ...moneyField({ required: true }) },
    // Teacher deposits (4%) collected from teacher for all enrolled students
    teacherDepositsHeldPaise: { ...moneyField() },
    // What teacher actually receives
    teacherPayoutPaise:       { ...moneyField({ required: true }) },
    // Platform commission
    platformFeePaise:         { ...moneyField() },
    // Total refunded to students
    studentRefundTotalPaise:  { ...moneyField() },
    currency: { type: String, default: 'INR', uppercase: true },
    // ── Status ────────────────────────────────────────────────────────────────
    stage:  enumField(PAYOUT_STAGE,  PAYOUT_STAGE.ESCROW_RELEASED),
    status: enumField(PAYOUT_STATUS, PAYOUT_STATUS.QUEUED),
    // ── Razorpay ──────────────────────────────────────────────────────────────
    razorpayPayoutId:      { type: String, trim: true, unique: true, sparse: true, index: true },
    razorpayFundAccountId: { type: String, trim: true, select: false },
    mode:    { type: String, enum: ['NEFT', 'IMPS', 'UPI', 'RTGS'], default: 'IMPS' },
    purpose: { type: String, default: 'payout', trim: true },
    // ── Bank snapshot ────────────────────────────────────────────────────────
    bankAccount: { type: bankSnapshotSchema, default: null },
    // ── Retry ─────────────────────────────────────────────────────────────────
    retryCount:        { type: Number, default: 0, min: 0, max: 5 },
    lastFailureReason: { type: String, trim: true, default: null },
    nextRetryAt:       { type: Date,   default: null, index: true },
    // ── Admin control ─────────────────────────────────────────────────────────
    onHold:       { type: Boolean, default: false, index: true },
    onHoldReason: { type: String,  trim: true, default: null },
    // ── Timeline ──────────────────────────────────────────────────────────────
    initiatedAt: { type: Date, default: null },
    settledAt:   { type: Date, default: null },
    failedAt:    { type: Date, default: null },
    utr:         { type: String, trim: true, default: null },
    audit:       { type: auditSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

payoutSchema.plugin(mongoosePaginate);
payoutSchema.plugin(mongooseAggregatePaginate);
payoutSchema.plugin(mongooseLeanVirtuals);

payoutSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, onHold: 1, nextRetryAt: 1 });
payoutSchema.index({ classroomId: 1 });
payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ settledAt: -1 }, { sparse: true });

// ── Virtuals ───────────────────────────────────────────────────────────────────
payoutSchema.virtual('teacherPayoutRupees').get(function () {
  return this.teacherPayoutPaise / 100;
});
payoutSchema.virtual('canRetry').get(function () {
  return this.status === PAYOUT_STATUS.FAILED && this.retryCount < 5 && !this.onHold;
});

// ── Instance methods ──────────────────────────────────────────────────────────
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
  this.retryCount       += 1;
  const backoffs         = [15, 60, 240, 720, 1440];
  const delay            = backoffs[Math.min(this.retryCount - 1, backoffs.length - 1)];
  this.nextRetryAt       = new Date(Date.now() + delay * 60 * 1000);
  return this.save();
};

payoutSchema.methods.putOnHold = async function (reason, adminId) {
  this.onHold            = true;
  this.onHoldReason      = reason;
  this.status            = PAYOUT_STATUS.ON_HOLD;
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'on_hold';
  return this.save();
};

payoutSchema.methods.releaseHold = async function (adminId) {
  this.onHold            = false;
  this.status            = PAYOUT_STATUS.QUEUED;
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'hold_released';
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
payoutSchema.statics.processingQueue = function (batchSize = 50) {
  return this.find({
    status: PAYOUT_STATUS.QUEUED,
    onHold: false,
    $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }],
  })
    .limit(batchSize)
    .sort({ createdAt: 1 })
    .lean();
};

payoutSchema.statics.teacherEarnings = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: -1 },
      populate: { path: 'classroomId', select: 'title subject' },
      ...options,
    },
  );
};

payoutSchema.statics.earningsSummary = function (teacherId) {
  return this.aggregate([
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
    {
      $group: {
        _id:        '$status',
        totalPaise: { $sum: '$teacherPayoutPaise' },
        count:      { $sum: 1 },
      },
    },
    {
      $project: {
        status:      '$_id',
        totalRupees: { $divide: ['$totalPaise', 100] },
        count:       1,
        _id:         0,
      },
    },
  ]);
};

payoutSchema.query.settled = function () { return this.where({ status: PAYOUT_STATUS.COMPLETED }); };
payoutSchema.query.pending = function () {
  return this.where({ status: { $in: [PAYOUT_STATUS.QUEUED, PAYOUT_STATUS.PROCESSING] } });
};

export const Payout = mongoose.model('Payout', payoutSchema);