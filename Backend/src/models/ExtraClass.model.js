// ─────────────────────────────────────────────────────────────────────────────
// src/models/ExtraClass.model.js
//
// Teacher can request extra (bonus) classes beyond the scheduled ones.
// Admin must approve before it appears on students' schedules.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { EXTRA_CLASS_STATUS } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  auditSchema,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

const extraClassSchema = new Schema(
  {
    classroomId: {
      type:     Schema.Types.ObjectId,
      ref:      'Classroom',
      required: [true, 'Classroom ID is required'],
      index:    true,
    },
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },
    // Proposed schedule for the extra class
    scheduledAt:     { type: Date,   required: [true, 'Scheduled date/time is required'] },
    durationMinutes: { type: Number, required: [true, 'Duration is required'], min: 15 },
    reason: {
      type:      String,
      required:  [true, 'Reason for extra class is required'],
      trim:      true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    gmeetLink: { type: String, trim: true, default: null },
    status:    enumField(EXTRA_CLASS_STATUS, EXTRA_CLASS_STATUS.PENDING),
    // Set after admin approves/rejects
    audit: { type: auditSchema, default: () => ({}) },
    // Was the extra class conducted?
    isConducted: { type: Boolean, default: false },
    conductedAt: { type: Date,   default: null },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

extraClassSchema.plugin(mongoosePaginate);
extraClassSchema.plugin(mongooseLeanVirtuals);

extraClassSchema.index({ classroomId: 1, status: 1 });
extraClassSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
extraClassSchema.index({ status: 1, createdAt: 1 }); // admin queue

// ── Instance methods ──────────────────────────────────────────────────────────
extraClassSchema.methods.approve = async function (adminId, note = '') {
  this.status            = EXTRA_CLASS_STATUS.APPROVED;
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'approved';
  this.audit.reviewNote  = note;
  return this.save();
};

extraClassSchema.methods.reject = async function (adminId, reason) {
  if (!reason) throw new Error('Rejection reason required');
  this.status            = EXTRA_CLASS_STATUS.REJECTED;
  this.audit.reviewedBy  = adminId;
  this.audit.reviewedAt  = new Date();
  this.audit.adminAction = 'rejected';
  this.audit.reviewNote  = reason;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
extraClassSchema.statics.pendingQueue = function (options = {}) {
  return this.paginate(
    { status: EXTRA_CLASS_STATUS.PENDING },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: 1 },
      populate: [
        { path: 'teacherId',   select: 'name phone' },
        { path: 'classroomId', select: 'title subject' },
      ],
      ...options,
    },
  );
};

export const ExtraClass = mongoose.model('ExtraClass', extraClassSchema);