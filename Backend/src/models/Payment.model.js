// ─────────────────────────────────────────────────────────────────────────────
// src/models/Payment.model.js
//
// Architecture decisions:
//  • One Payment document per booking — 1:1 relationship.
//  • razorpayOrderId + razorpayPaymentId stored raw for webhook reconciliation.
//  • razorpaySignature stored (select: false) — used once to verify, then sealed.
//  • escrowStatus drives the payout release workflow (separate from payment).
//  • All amounts in paise — matches Razorpay's API which uses smallest unit.
//  • webhookEvents[] is an append-only log — never mutated, only pushed to.
//    Enables full reconciliation replay without external log storage.
//  • refundedAmountPaise supports partial refunds.
//  • idempotencyKey guards against double-capture from duplicate webhooks.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose                  from 'mongoose';
import mongoosePaginate          from 'mongoose-paginate-v2';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals      from 'mongoose-lean-virtuals';

import { PAYMENT_STATUS, ESCROW_STATUS }   from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  defaultPaginateOptions,
}                                           from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Webhook Event sub-document ────────────────────────────────────────────────
// Append-only log of every Razorpay webhook event for this payment.
const webhookEventSchema = new Schema(
  {
    event:      { type: String, required: true },     // e.g. 'payment.captured'
    receivedAt: { type: Date,   default: Date.now },
    payload:    { type: Schema.Types.Mixed },          // full Razorpay payload
    processed:  { type: Boolean, default: false },
  },
  { _id: true },
);

// ── Razorpay Refund sub-document ──────────────────────────────────────────────
const razorpayRefundSchema = new Schema(
  {
    razorpayRefundId:  { type: String, required: true },
    amountPaise:       moneyField({ required: true }),
    reason:            { type: String, trim: true },
    status:            { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    initiatedAt:       { type: Date, default: Date.now },
    settledAt:         { type: Date, default: null },
  },
  { _id: true },
);

// ── Main Payment schema ───────────────────────────────────────────────────────

const paymentSchema = new Schema(
  {
    bookingId: {
      type:     Schema.Types.ObjectId,
      ref:      'Booking',
      required: [true, 'Booking ID is required'],
      unique:   true,     // 1:1 with booking
      index:    true,
    },
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },

    // ── Razorpay identifiers ──────────────────────────────────────────────────
    razorpayOrderId: {
      type:   String,
      trim:   true,
      unique: true,
      sparse: true,
      index:  true,
    },
    razorpayPaymentId: {
      type:   String,
      trim:   true,
      unique: true,
      sparse: true,
      index:  true,
    },
    razorpaySignature: {
      type:   String,
      trim:   true,
      select: false,   // sensitive — verified once, never exposed
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status:       enumField(PAYMENT_STATUS, PAYMENT_STATUS.CREATED),
    escrowStatus: enumField(ESCROW_STATUS,  ESCROW_STATUS.HOLDING),

    // ── Amounts (paise) ───────────────────────────────────────────────────────
    totalAmountPaise:    { ...moneyField({ required: true }) },
    commissionPaise:     { ...moneyField() },
    teacherPayoutPaise:  { ...moneyField() },
    refundedAmountPaise: { ...moneyField() },     // cumulative refunds
    gstPaise:            { ...moneyField() },     // future: GST on commission
    netRevenuePaise:     { ...moneyField() },     // commissionPaise - gstPaise

    // ── Payment gateway metadata ──────────────────────────────────────────────
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    gateway:  { type: String, default: 'razorpay', enum: ['razorpay', 'manual'] },
    method:   { type: String, trim: true, default: null },  // upi/card/netbanking etc.

    // ── Idempotency ───────────────────────────────────────────────────────────
    idempotencyKey: {
      type:   String,
      trim:   true,
      unique: true,
      sparse: true,
      select: false,
    },

    // ── Escrow release tracking ───────────────────────────────────────────────
    escrowHeldAt:    { type: Date, default: null },
    escrowReleasedAt:{ type: Date, default: null },
    escrowReleaseReason: { type: String, trim: true, default: null },

    // ── Timestamps for gateway events ─────────────────────────────────────────
    authorizedAt: { type: Date, default: null },
    capturedAt:   { type: Date, default: null },
    failedAt:     { type: Date, default: null },

    // ── Webhook event log (append-only) ──────────────────────────────────────
    webhookEvents: { type: [webhookEventSchema], default: [] },

    // ── Razorpay refunds log ──────────────────────────────────────────────────
    refunds: { type: [razorpayRefundSchema], default: [] },

    // ── Failure info ─────────────────────────────────────────────────────────
    failureCode:    { type: String, default: null },
    failureMessage: { type: String, default: null },

    // ── Related payout (set when payout is created) ───────────────────────────
    payoutId: { type: Schema.Types.ObjectId, ref: 'Payout', default: null },
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

paymentSchema.plugin(mongoosePaginate);
paymentSchema.plugin(mongooseAggregatePaginate);
paymentSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ escrowStatus: 1, escrowHeldAt: 1 });    // release queue
paymentSchema.index({ teacherId: 1, escrowStatus: 1 });
paymentSchema.index({ studentId: 1, status: 1, createdAt: -1 });

// Reconciliation: find payments captured but payout not created
paymentSchema.index(
  { escrowStatus: 1, payoutId: 1 },
  { partialFilterExpression: { escrowStatus: ESCROW_STATUS.RELEASED } },
);

// ── Virtuals ─────────────────────────────────────────────────────────────────

paymentSchema.virtual('totalAmountRupees').get(function () {
  return this.totalAmountPaise / 100;
});

paymentSchema.virtual('isCaptured').get(function () {
  return this.status === PAYMENT_STATUS.CAPTURED;
});

paymentSchema.virtual('isEscrowHeld').get(function () {
  return this.escrowStatus === ESCROW_STATUS.HOLDING;
});

paymentSchema.virtual('remainingAmountPaise').get(function () {
  return this.totalAmountPaise - this.refundedAmountPaise;
});

// ── Instance methods ─────────────────────────────────────────────────────────

/**
 * Called on Razorpay payment.captured webhook.
 */
paymentSchema.methods.capture = async function ({ razorpayPaymentId, razorpaySignature, method }) {
  this.status            = PAYMENT_STATUS.CAPTURED;
  this.escrowStatus      = ESCROW_STATUS.HOLDING;
  this.razorpayPaymentId = razorpayPaymentId;
  this.razorpaySignature = razorpaySignature;
  this.method            = method || null;
  this.capturedAt        = new Date();
  this.escrowHeldAt      = new Date();
  this.netRevenuePaise   = this.commissionPaise - (this.gstPaise || 0);
  return this.save();
};

/**
 * Release escrow after session completion — triggers payout queue.
 */
paymentSchema.methods.releaseEscrow = async function (reason = 'session_completed') {
  if (this.escrowStatus !== ESCROW_STATUS.HOLDING) {
    throw new Error('Cannot release escrow: not in HOLDING state');
  }
  this.escrowStatus        = ESCROW_STATUS.RELEASED;
  this.escrowReleasedAt    = new Date();
  this.escrowReleaseReason = reason;
  return this.save();
};

/**
 * Append a webhook event to the immutable log.
 */
paymentSchema.methods.logWebhookEvent = function (event, payload) {
  this.webhookEvents.push({ event, payload, processed: false });
  return this.save();
};

/**
 * Record a refund sub-document and update cumulative refunded amount.
 */
paymentSchema.methods.addRefund = async function ({ razorpayRefundId, amountPaise, reason }) {
  this.refunds.push({ razorpayRefundId, amountPaise, reason });
  this.refundedAmountPaise += amountPaise;

  const isFullRefund = this.refundedAmountPaise >= this.totalAmountPaise;
  
  // Enums fallback mapping to avoid undefined states
  this.status       = isFullRefund ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.CAPTURED; 
  this.escrowStatus = isFullRefund ? ESCROW_STATUS.REFUNDED  : ESCROW_STATUS.HOLDING;

  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Find escrow-ready payments: captured, holding, no payout yet.
 * Used by payout cron job.
 */
paymentSchema.statics.escrowReleaseQueue = function (limit = 100) {
  return this.find({
    status:       PAYMENT_STATUS.CAPTURED,
    escrowStatus: ESCROW_STATUS.RELEASED,
    payoutId:     null,
  })
    .limit(limit)
    .sort({ escrowReleasedAt: 1 })
    .lean();
};

/**
 * Revenue summary aggregation — admin analytics.
 */
paymentSchema.statics.revenueSummary = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status:    PAYMENT_STATUS.CAPTURED,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id:              null,
        totalGmvPaise:    { $sum: '$totalAmountPaise' },
        totalCommission:  { $sum: '$commissionPaise' },
        totalPayouts:     { $sum: '$teacherPayoutPaise' },
        totalRefunds:     { $sum: '$refundedAmountPaise' },
        count:            { $sum: 1 },
      },
    },
    {
      $project: {
        _id:                0,
        totalGmvRupees:     { $divide: ['$totalGmvPaise',   100] },
        totalCommission:    { $divide: ['$totalCommission', 100] },
        totalPayouts:       { $divide: ['$totalPayouts',    100] },
        totalRefunds:       { $divide: ['$totalRefunds',    100] },
        transactionCount:   '$count',
      },
    },
  ]);
};

/**
 * Daily revenue time-series for charts.
 */
paymentSchema.statics.dailyRevenueSeries = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        status:    PAYMENT_STATUS.CAPTURED,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id:             { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        gmvPaise:        { $sum: '$totalAmountPaise' },
        commissionPaise: { $sum: '$commissionPaise' },
        transactions:    { $sum: 1 },
      },
    },
    {
      $addFields: {
        gmvRupees:        { $divide: ['$gmvPaise',        100] },
        commissionRupees: { $divide: ['$commissionPaise', 100] },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ── Query helpers ─────────────────────────────────────────────────────────────

paymentSchema.query.captured = function () {
  return this.where({ status: PAYMENT_STATUS.CAPTURED });
};

paymentSchema.query.escrowHeld = function () {
  return this.where({ escrowStatus: ESCROW_STATUS.HOLDING });
};

// ─────────────────────────────────────────────────────────────────────────────
export const Payment = mongoose.model('Payment', paymentSchema);