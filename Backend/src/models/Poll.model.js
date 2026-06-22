// ─────────────────────────────────────────────────────────────────────────────
// src/models/Poll.model.js
//
// Two types:
//   GENERAL   — teacher creates polls (quiz/feedback/etc.)
//   EARLY_END — system creates this when teacher requests early course completion.
//               If ≥70% enrolled students vote YES → classroom can close early.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { POLL_TYPE, POLL_STATUS } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Vote entry sub-doc ────────────────────────────────────────────────────────
const voteSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    optionIndex:{ type: Number, required: true, min: 0 },  // index into options[]
    votedAt:   { type: Date, default: Date.now },
  },
  { _id: true },
);

// ── Poll option sub-doc ───────────────────────────────────────────────────────
const pollOptionSchema = new Schema(
  {
    text:      { type: String, required: true, trim: true, maxlength: 200 },
    voteCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const pollSchema = new Schema(
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
    type:   enumField(POLL_TYPE,   POLL_TYPE.GENERAL),
    status: enumField(POLL_STATUS, POLL_STATUS.ACTIVE),
    question: {
      type:      String,
      required:  [true, 'Poll question is required'],
      trim:      true,
      maxlength: [500, 'Question cannot exceed 500 characters'],
    },
    options: {
      type:     [pollOptionSchema],
      validate: {
        validator: (arr) => arr.length >= 2 && arr.length <= 10,
        message:   'Poll must have between 2 and 10 options',
      },
    },
    votes:        { type: [voteSchema], default: [] },
    totalVotes:   { type: Number, default: 0, min: 0 },
    expiresAt:    { type: Date, default: null, index: true },
    // For EARLY_END polls: result summary
    earlyEndApprovalPercent: { type: Number, default: null },
    earlyEndResolved:        { type: Boolean, default: false },
    // Allow each student to vote only once (enforced in service)
    allowMultipleVotes: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

pollSchema.plugin(mongoosePaginate);
pollSchema.plugin(mongooseLeanVirtuals);

pollSchema.index({ classroomId: 1, status: 1, type: 1, createdAt: -1 });
pollSchema.index({ type: 1, status: 1, expiresAt: 1 }); // cron: auto-close expired

// ── Instance methods ──────────────────────────────────────────────────────────
pollSchema.methods.castVote = async function (studentId, optionIndex) {
  if (this.status !== POLL_STATUS.ACTIVE) throw new Error('Poll is not active');
  if (optionIndex < 0 || optionIndex >= this.options.length) throw new Error('Invalid option');
  if (!this.allowMultipleVotes && this.votes.some((v) => v.studentId.equals(studentId))) {
    throw new Error('Already voted');
  }
  this.votes.push({ studentId, optionIndex });
  this.options[optionIndex].voteCount += 1;
  this.totalVotes += 1;
  return this.save();
};

pollSchema.methods.close = async function () {
  this.status = POLL_STATUS.CLOSED;
  if (this.type === POLL_TYPE.EARLY_END) {
    // option[0] = YES, option[1] = NO (by convention in service layer)
    const yesVotes = this.options[0]?.voteCount || 0;
    this.earlyEndApprovalPercent = this.totalVotes > 0
      ? Math.round((yesVotes / this.totalVotes) * 100)
      : 0;
    this.earlyEndResolved = true;
  }
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
/**
 * Cron: find EARLY_END polls past expiry that haven't been resolved.
 */
pollSchema.statics.overdueEarlyEndPolls = function () {
  return this.find({
    type:             POLL_TYPE.EARLY_END,
    status:           POLL_STATUS.ACTIVE,
    earlyEndResolved: false,
    expiresAt:        { $lt: new Date() },
  }).lean();
};

pollSchema.statics.forClassroom = function (classroomId, options = {}) {
  return this.paginate(
    { classroomId, status: POLL_STATUS.ACTIVE },
    {
      ...defaultPaginateOptions,
      sort: { createdAt: -1 },
      ...options,
    },
  );
};

export const Poll = mongoose.model('Poll', pollSchema);