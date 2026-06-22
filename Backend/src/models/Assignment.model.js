// ─────────────────────────────────────────────────────────────────────────────
// src/models/Assignment.model.js
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { ASSIGNMENT_STATUS, SUBMISSION_STATUS } from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  urlValidator,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Submission sub-doc ────────────────────────────────────────────────────────
const submissionSchema = new Schema(
  {
    studentId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    status:      enumField(SUBMISSION_STATUS, SUBMISSION_STATUS.PENDING),
    submittedAt: { type: Date, default: null },
    fileUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 10 files, must be valid URLs',
      },
    },
    textAnswer: {
      type:      String,
      trim:      true,
      maxlength: [5000, 'Answer cannot exceed 5000 characters'],
      default:   '',
    },
    // Grading
    grade:    { type: Number, default: null, min: 0 },
    feedback: { type: String, trim: true, default: '' },
    gradedAt: { type: Date,   default: null },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true },
);

const assignmentSchema = new Schema(
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
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    instructions: {
      type:      String,
      trim:      true,
      maxlength: [5000, 'Instructions cannot exceed 5000 characters'],
      default:   '',
    },
    attachmentUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 10 attachments, must be valid URLs',
      },
    },
    dueDate:   { type: Date,   default: null, index: true },
    maxGrade:  { type: Number, default: 100, min: 1 },
    status:    enumField(ASSIGNMENT_STATUS, ASSIGNMENT_STATUS.DRAFT),
    submissions:{ type: [submissionSchema], default: [] },
    topic:     { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

assignmentSchema.plugin(mongoosePaginate);
assignmentSchema.plugin(mongooseLeanVirtuals);

assignmentSchema.index({ classroomId: 1, status: 1, dueDate: 1 });
assignmentSchema.index({ teacherId: 1, classroomId: 1 });

// ── Instance methods ──────────────────────────────────────────────────────────
assignmentSchema.methods.publish = async function () {
  if (this.status !== ASSIGNMENT_STATUS.DRAFT) throw new Error('Only draft assignments can be published');
  this.status = ASSIGNMENT_STATUS.PUBLISHED;
  return this.save();
};

assignmentSchema.methods.addOrUpdateSubmission = async function (studentId, data) {
  const existing = this.submissions.find((s) => s.studentId.equals(studentId));
  if (existing) {
    Object.assign(existing, data, {
      status:      SUBMISSION_STATUS.SUBMITTED,
      submittedAt: new Date(),
    });
  } else {
    this.submissions.push({
      studentId,
      status:      SUBMISSION_STATUS.SUBMITTED,
      submittedAt: new Date(),
      ...data,
    });
  }
  return this.save();
};

assignmentSchema.methods.gradeSubmission = async function (studentId, grade, feedback, graderId) {
  const submission = this.submissions.find((s) => s.studentId.equals(studentId));
  if (!submission) throw new Error('Submission not found');
  submission.grade    = grade;
  submission.feedback = feedback;
  submission.status   = SUBMISSION_STATUS.GRADED;
  submission.gradedAt = new Date();
  submission.gradedBy = graderId;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
assignmentSchema.statics.forClassroom = function (classroomId, options = {}) {
  return this.paginate(
    { classroomId, status: ASSIGNMENT_STATUS.PUBLISHED },
    {
      ...defaultPaginateOptions,
      sort: { dueDate: 1, createdAt: -1 },
      ...options,
    },
  );
};

export const Assignment = mongoose.model('Assignment', assignmentSchema);