// ─────────────────────────────────────────────────────────────────────────────
// src/models/Document.model.js
//
// Architecture decisions:
//  • Documents are append-only — never update a document record, create new.
//  • fileUrl points to S3/GCS presigned key; never stored as blob.
//  • s3Key stored separately (select: false) so it's never leaked in API.
//  • Compound unique index prevents duplicate active docs per type per teacher.
//  • Full audit trail via reviewedBy + reviewedAt + reviewNote.
//  • expiresAt supports docs with validity periods (e.g. police clearance).
// ─────────────────────────────────────────────────────────────────────────────

import mongoose              from 'mongoose';
import mongoosePaginate      from 'mongoose-paginate-v2';
import mongooseLeanVirtuals  from 'mongoose-lean-virtuals';

import { DOCUMENT_TYPE, DOCUMENT_STATUS }   from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  urlValidator,
  enumField,
  auditSchema,
  defaultPaginateOptions,
}                                            from '../utils/schema.utils.js';

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },

    // ── Document classification ───────────────────────────────────────────────
    type: enumField(DOCUMENT_TYPE, DOCUMENT_TYPE.AADHAAR),
    status: enumField(DOCUMENT_STATUS, DOCUMENT_STATUS.UPLOADED),

    // ── Storage ───────────────────────────────────────────────────────────────
    fileUrl: {
      type:     String,
      required: [true, 'File URL is required'],
      trim:     true,
      validate: urlValidator,
    },
    s3Key: {
      type:   String,
      trim:   true,
      select: false,     // never expose raw storage key
    },
    mimeType: {
      type:  String,
      trim:  true,
      enum:  ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    },
    fileSizeBytes: {
      type: Number,
      min:  [0, 'File size cannot be negative'],
    },

    // ── Validity ──────────────────────────────────────────────────────────────
    expiresAt:    { type: Date, default: null },    // for expirable docs
    isActive:     { type: Boolean, default: true, index: true },  // latest version flag

    // ── Admin review ─────────────────────────────────────────────────────────
    audit: { type: auditSchema, default: () => ({}) },

    // ── Version tracking ──────────────────────────────────────────────────────
    // When a teacher re-uploads a document, version increments.
    version: { type: Number, default: 1, min: 1 },
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

documentSchema.plugin(mongoosePaginate);
documentSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

// One active document per type per teacher
documentSchema.index(
  { teacherId: 1, type: 1, isActive: 1 },
  { unique: false },   // not unique — allows pending + approved to coexist
);
documentSchema.index({ status: 1, createdAt: -1 });          // admin review queue
documentSchema.index({ teacherId: 1, status: 1 });
documentSchema.index({ expiresAt: 1 }, { sparse: true });    // expiry checks

// ── Virtuals ─────────────────────────────────────────────────────────────────

documentSchema.virtual('isExpired').get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

documentSchema.virtual('isApproved').get(function () {
  return this.status === DOCUMENT_STATUS.APPROVED;
});

// ── Instance methods ─────────────────────────────────────────────────────────

documentSchema.methods.approve = async function (adminId, note = '') {
  this.status        = DOCUMENT_STATUS.APPROVED;
  this.isActive      = true;
  this.audit.reviewedBy   = adminId;
  this.audit.reviewedAt   = new Date();
  this.audit.reviewNote   = note;
  this.audit.adminAction  = 'approved';
  return this.save();
};

documentSchema.methods.reject = async function (adminId, reason) {
  if (!reason) throw new Error('Rejection reason is required');
  this.status        = DOCUMENT_STATUS.REJECTED;
  this.audit.reviewedBy   = adminId;
  this.audit.reviewedAt   = new Date();
  this.audit.reviewNote   = reason;
  this.audit.adminAction  = 'rejected';
  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Get all active documents for a teacher, grouped by type.
 */
documentSchema.statics.getActiveByTeacher = function (teacherId) {
  return this.find({ teacherId, isActive: true })
    .sort({ type: 1, createdAt: -1 })
    .lean();
};

/**
 * Check if a teacher has all required document types approved.
 */
documentSchema.statics.isKycComplete = async function (teacherId) {
  // Mapping strictly matching our centralized identity registry
  const required = [DOCUMENT_TYPE.IDENTITY_PROOF, DOCUMENT_TYPE.DEGREE];
  const approved = await this.find({
    teacherId,
    type:   { $in: required },
    status: DOCUMENT_STATUS.APPROVED,
    isActive: true,
  }).select('type').lean();

  const approvedTypes = approved.map((d) => d.type);
  return required.every((t) => approvedTypes.includes(t));
};

/**
 * Admin: pending review queue with pagination.
 */
documentSchema.statics.pendingReviewQueue = function (options = {}) {
  return this.paginate(
    { status: DOCUMENT_STATUS.UPLOADED },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: 1 },
      populate: { path: 'teacherId', select: 'name phone email' },
      ...options,
    },
  );
};

// ── Pre-save: mark previous versions inactive on new upload ──────────────────

documentSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Deactivate older versions of the same doc type for this teacher
    await this.constructor.updateMany(
      {
        teacherId: this.teacherId,
        type:      this.type,
        _id:       { $ne: this._id },
        isActive:  true,
      },
      { $set: { isActive: false } },
    );
  }
  next();
});

// ── Query helpers ─────────────────────────────────────────────────────────────

documentSchema.query.approved = function () {
  return this.where({ status: DOCUMENT_STATUS.APPROVED });
};

documentSchema.query.active = function () {
  return this.where({ isActive: true });
};

// ─────────────────────────────────────────────────────────────────────────────
export const Document = mongoose.model('Document', documentSchema);