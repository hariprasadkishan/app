// ─────────────────────────────────────────────────────────────────────────────
// src/models/EnrollmentQuery.model.js
//
// A student spends 1 token to send an enrollment query to a classroom.
// Teacher has 5 days to accept/reject. No response = auto-expired (token refunded).
// If accepted, teacher's 4% deposit is charged. Student has 5 days to enroll.
// If student doesn't enroll, teacher gets 4% back; student loses nothing extra.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { QUERY_STATUS }     from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// Auto-expire deadlines (in days) per product spec
const TEACHER_RESPONSE_DEADLINE_DAYS = 5;
const STUDENT_ENROLL_DEADLINE_DAYS   = 5;

const enrollmentQuerySchema = new Schema(
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
    // ── Status ────────────────────────────────────────────────────────────────
    status: enumField(QUERY_STATUS, QUERY_STATUS.PENDING),
    // ── Token tracking ────────────────────────────────────────────────────────
    tokensSpent:   { type: Number, default: 1, min: 1 },  // currently always 1
    tokenRefunded: { type: Boolean, default: false },
    // ── Message from student to teacher ───────────────────────────────────────
    message: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
      default:   '',
    },
    // ── Deadlines ────────────────────────────────────────────────────────────
    // Teacher must respond by this date or query auto-expires
    teacherResponseDeadline: {
      type:    Date,
      default: () => new Date(Date.now() + TEACHER_RESPONSE_DEADLINE_DAYS * 86400000),
      index:   true,
    },
    // Student must enroll by this date after acceptance (set on acceptance)
    studentEnrollDeadline: {
      type:    Date,
      default: null,
      index:   true,
    },
    // ── Teacher response ──────────────────────────────────────────────────────
    respondedAt:      { type: Date, default: null },
    rejectionReason:  { type: String, trim: true, default: null },
    // ── Teacher deposit (4% of classroom fee) charged when query is accepted ──
    teacherDepositPaise:  { ...moneyField() }, // 4% of classroom fees
    teacherDepositPaid:   { type: Boolean, default: false },
    teacherDepositRefunded: { type: Boolean, default: false },
    // ── Enrollment link (set when student enrolls) ─────────────────────────────
    enrollmentId: {
      type:    Schema.Types.ObjectId,
      ref:     'Enrollment',
      default: null,
      index:   true,
    },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

enrollmentQuerySchema.plugin(mongoosePaginate);
enrollmentQuerySchema.plugin(mongooseLeanVirtuals);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Prevent duplicate query from same student to same classroom
enrollmentQuerySchema.index(
  { studentId: 1, classroomId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'accepted'] },
    },
  },
);
enrollmentQuerySchema.index({ teacherId: 1, status: 1, createdAt: -1 });
enrollmentQuerySchema.index({ studentId: 1, status: 1, createdAt: -1 });
enrollmentQuerySchema.index({ status: 1, teacherResponseDeadline: 1 });  // cron: auto-expire
enrollmentQuerySchema.index({ status: 1, studentEnrollDeadline: 1 });    // cron: lapse accepted

// ── Virtuals ───────────────────────────────────────────────────────────────────
enrollmentQuerySchema.virtual('isTeacherResponseOverdue').get(function () {
  return this.status === QUERY_STATUS.PENDING && this.teacherResponseDeadline < new Date();
});
enrollmentQuerySchema.virtual('isStudentEnrollOverdue').get(function () {
  return (
    this.status === QUERY_STATUS.ACCEPTED &&
    this.studentEnrollDeadline &&
    this.studentEnrollDeadline < new Date()
  );
});

// ── Instance methods ──────────────────────────────────────────────────────────
enrollmentQuerySchema.methods.accept = async function (teacherDepositPaise) {
  if (this.status !== QUERY_STATUS.PENDING) {
    throw new Error(`Cannot accept query in status: ${this.status}`);
  }
  this.status               = QUERY_STATUS.ACCEPTED;
  this.respondedAt          = new Date();
  this.teacherDepositPaise  = teacherDepositPaise;
  this.teacherDepositPaid   = true;
  this.studentEnrollDeadline = new Date(Date.now() + STUDENT_ENROLL_DEADLINE_DAYS * 86400000);
  return this.save();
};

enrollmentQuerySchema.methods.reject = async function (reason = '') {
  if (this.status !== QUERY_STATUS.PENDING) {
    throw new Error(`Cannot reject query in status: ${this.status}`);
  }
  this.status          = QUERY_STATUS.REJECTED;
  this.respondedAt     = new Date();
  this.rejectionReason = reason;
  return this.save();
};

enrollmentQuerySchema.methods.expire = async function () {
  // Called by cron when teacher doesn't respond in 5 days
  this.status = QUERY_STATUS.EXPIRED;
  return this.save();
};

enrollmentQuerySchema.methods.lapse = async function () {
  // Called by cron when student doesn't enroll in 5 days after acceptance
  this.status = QUERY_STATUS.LAPSED;
  return this.save();
};

enrollmentQuerySchema.methods.markEnrolled = async function (enrollmentId) {
  this.status       = QUERY_STATUS.ENROLLED;
  this.enrollmentId = enrollmentId;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
/**
 * Cron: find pending queries past their teacher response deadline.
 */
enrollmentQuerySchema.statics.overdueForTeacher = function () {
  return this.find({
    status:                  QUERY_STATUS.PENDING,
    teacherResponseDeadline: { $lt: new Date() },
  }).lean();
};

/**
 * Cron: find accepted queries where student hasn't enrolled yet past deadline.
 */
enrollmentQuerySchema.statics.overdueForStudent = function () {
  return this.find({
    status:               QUERY_STATUS.ACCEPTED,
    studentEnrollDeadline:{ $lt: new Date() },
    enrollmentId:         null,
  }).lean();
};

/**
 * Student's query history for a classroom (to check if already queried).
 */
enrollmentQuerySchema.statics.findActiveQuery = function (studentId, classroomId) {
  return this.findOne({
    studentId,
    classroomId,
    status: { $in: [QUERY_STATUS.PENDING, QUERY_STATUS.ACCEPTED] },
  });
};

export const EnrollmentQuery = mongoose.model('EnrollmentQuery', enrollmentQuerySchema);