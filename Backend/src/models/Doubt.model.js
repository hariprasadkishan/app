// ─────────────────────────────────────────────────────────────────────────────
// src/models/Doubt.model.js
//
// Students can post doubts in their enrolled classrooms.
// Public: visible to all enrolled students.
// Private: visible only to the teacher.
// Teacher answers from the doubts section of their dashboard.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { DOUBT_VISIBILITY, DOUBT_STATUS } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  urlValidator,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Answer sub-doc ────────────────────────────────────────────────────────────
const answerSchema = new Schema(
  {
    text: {
      type:      String,
      trim:      true,
      required:  [true, 'Answer text is required'],
      maxlength: [3000, 'Answer cannot exceed 3000 characters'],
    },
    attachmentUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 5 attachments, all must be valid URLs',
      },
    },
    answeredAt: { type: Date, default: Date.now },
    answeredBy: { type: Schema.Types.ObjectId, ref: 'User' }, // teacher
  },
  { _id: false },
);

const doubtSchema = new Schema(
  {
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Student ID is required'],
      index:    true,
    },
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
    // Context: which topic/lecture this doubt is about
    topic: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Topic cannot exceed 200 characters'],
      default:   '',
    },
    question: {
      type:      String,
      required:  [true, 'Question is required'],
      trim:      true,
      maxlength: [2000, 'Question cannot exceed 2000 characters'],
    },
    attachmentUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 5 attachments, must be valid URLs',
      },
    },
    visibility: enumField(DOUBT_VISIBILITY, DOUBT_VISIBILITY.PUBLIC),
    status:     enumField(DOUBT_STATUS, DOUBT_STATUS.OPEN),
    answer:     { type: answerSchema, default: null },
    // Upvotes from other students (for public doubts)
    upvotes:    { type: Number, default: 0, min: 0 },
    upvotedBy:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

doubtSchema.plugin(mongoosePaginate);
doubtSchema.plugin(mongooseLeanVirtuals);

doubtSchema.index({ classroomId: 1, visibility: 1, status: 1, createdAt: -1 });
doubtSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
doubtSchema.index({ studentId: 1, classroomId: 1, createdAt: -1 });

// ── Instance methods ──────────────────────────────────────────────────────────
doubtSchema.methods.submitAnswer = async function (teacherId, text, attachmentUrls = []) {
  if (this.status === DOUBT_STATUS.CLOSED) throw new Error('Doubt is already closed');
  this.answer = { text, attachmentUrls, answeredBy: teacherId, answeredAt: new Date() };
  this.status = DOUBT_STATUS.ANSWERED;
  return this.save();
};

doubtSchema.methods.close = async function () {
  this.status = DOUBT_STATUS.CLOSED;
  return this.save();
};

doubtSchema.methods.upvote = async function (userId) {
  if (this.upvotedBy.includes(userId)) throw new Error('Already upvoted');
  this.upvotedBy.push(userId);
  this.upvotes += 1;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
/**
 * Teacher doubt inbox - open doubts across all their classrooms.
 */
doubtSchema.statics.teacherInbox = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId, status: DOUBT_STATUS.OPEN },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: -1 },
      populate: [
        { path: 'studentId',  select: 'name avatarUrl' },
        { path: 'classroomId', select: 'title subject' },
      ],
      ...options,
    },
  );
};

/**
 * Public doubts for a classroom (visible to all enrolled students).
 */
doubtSchema.statics.classroomPublicDoubts = function (classroomId, options = {}) {
  return this.paginate(
    { classroomId, visibility: DOUBT_VISIBILITY.PUBLIC },
    {
      ...defaultPaginateOptions,
      sort:     { upvotes: -1, createdAt: -1 },
      populate: { path: 'studentId', select: 'name avatarUrl' },
      ...options,
    },
  );
};

export const Doubt = mongoose.model('Doubt', doubtSchema);