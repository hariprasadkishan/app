// ─────────────────────────────────────────────────────────────────────────────
// src/models/Classroom.model.js
//
// Central entity. A teacher creates a classroom with subject, stream/topic,
// schedule, fees, mode (online/offline). Students request to enroll via queries.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose                  from 'mongoose';
import mongoosePaginate          from 'mongoose-paginate-v2';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals      from 'mongoose-lean-virtuals';
import {
  CLASSROOM_STATUS,
  CLASSROOM_MODE,
  VERIFICATION_STATUS,
} from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  moneyField,
  urlValidator,
  enumField,
  geoPointSchema,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

// ── Schedule slot sub-doc ─────────────────────────────────────────────────────
// Recurring weekly schedule entry
const scheduleSlotSchema = new Schema(
  {
    day:       { type: Number, required: true, min: 0, max: 6 }, // 0=Sun…6=Sat
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }, // HH:MM
    endTime:   { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    durationMinutes: { type: Number, required: true, min: 15 },
    // Actual conducted class linked here by cron after session ends
    conductedAt: { type: Date, default: null },
    isConducted: { type: Boolean, default: false },
    gmeetLink:   { type: String, trim: true, default: null }, // per-class link for online
  },
  { _id: true },
);

// ── Offline classroom facility sub-doc ────────────────────────────────────────
const offlineFacilitySchema = new Schema(
  {
    address:     { type: String, trim: true },
    location:    { type: geoPointSchema, default: null },
    city:        { type: String, trim: true, lowercase: true },
    state:       { type: String, trim: true, lowercase: true },
    pincode:     { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    photoUrls:   {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 10 photos, all must be valid URLs',
      },
    },
    videoUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 3 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 3 videos, all must be valid URLs',
      },
    },
    facilities: { type: [String], default: [] }, // e.g. ['AC', 'Projector', 'Whiteboard']
    capacity:   { type: Number, min: 1, default: null },
  },
  { _id: false },
);

// ── Stats sub-doc ─────────────────────────────────────────────────────────────
const classroomStatsSchema = new Schema(
  {
    totalQueries:       { type: Number, default: 0, min: 0 },
    acceptedQueries:    { type: Number, default: 0, min: 0 },
    enrolledStudents:   { type: Number, default: 0, min: 0 },
    avgRating:          { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:        { type: Number, default: 0, min: 0 },
    hoursCompleted:     { type: Number, default: 0, min: 0 }, // actual hours conducted
    totalEarningsPaise: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ── Main Classroom schema ──────────────────────────────────────────────────────
const classroomSchema = new Schema(
  {
    teacherId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Teacher ID is required'],
      index:    true,
    },
    // ── Core identity ─────────────────────────────────────────────────────────
    title: {
      type:      String,
      required:  [true, 'Classroom title is required'],
      trim:      true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
      // e.g. "Kinematics for JEE Advanced", "Guitar for Beginners", "10th Maths CBSE"
    },
    subject: {
      type:     String,
      required: [true, 'Subject is required'],
      trim:     true,
    },
    // Stream/level/target e.g. "JEE Advanced", "Beginners", "CBSE Grade 10"
    stream: {
      type:  String,
      trim:  true,
      default: null,
    },
    description: {
      type:      String,
      trim:      true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
      default:   '',
    },
    tags: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message:   'Max 20 tags allowed',
      },
    },
    thumbnailUrl: {
      type:     String,
      trim:     true,
      validate: urlValidator,
      default:  null,
    },
    // ── Course duration & scheduling ──────────────────────────────────────────
    totalHoursPlanned: {
      type:     Number,
      required: [true, 'Total planned hours is required'],
      min:      [1, 'At least 1 hour required'],
    },
    // Start and end date of the course (fixed at creation, cannot be extended/reduced)
    startDate: {
      type:     Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type:     Date,
      required: [true, 'End date is required'],
    },
    schedule: {
      type:    [scheduleSlotSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length > 0,
        message:   'At least one schedule slot is required',
      },
    },
    // gmeetLink is the default room for the teacher (host); can override per slot
    gmeetLink: {
      type:  String,
      trim:  true,
      default: null,
    },
    // ── Mode ─────────────────────────────────────────────────────────────────
    mode: enumField(CLASSROOM_MODE, CLASSROOM_MODE.ONLINE),
    offlineFacility: { type: offlineFacilitySchema, default: null },
    // ── Pricing ───────────────────────────────────────────────────────────────
    feesPaise: {
      ...moneyField({ required: [true, 'Fees is required'] }),
      min: [100, 'Minimum fee is ₹1'],
    },
    // ── Capacity ──────────────────────────────────────────────────────────────
    maxStudents: {
      type:     Number,
      required: [true, 'Maximum students limit is required'],
      min:      [1, 'At least 1 student required'],
      max:      [500, 'Cannot exceed 500 students per classroom'],
    },
    // ── Status ────────────────────────────────────────────────────────────────
    status: enumField(CLASSROOM_STATUS, CLASSROOM_STATUS.DRAFT),
    // ── Early completion (70% vote) ───────────────────────────────────────────
    earlyEndRequestedAt:   { type: Date,    default: null },
    earlyEndApprovedAt:    { type: Date,    default: null },
    earlyEndPollId:        { type: Schema.Types.ObjectId, ref: 'Poll', default: null },
    // ── Completion tracking ───────────────────────────────────────────────────
    completedAt:     { type: Date, default: null },
    completionCase:  { type: String, enum: ['case_1', 'case_2', 'case_3'], default: null },
    // ── Stats (denormalised) ──────────────────────────────────────────────────
    stats: { type: classroomStatsSchema, default: () => ({}) },
    // ── Admin ─────────────────────────────────────────────────────────────────
    adminNotes: { type: String, trim: true, default: null, select: false },
    // ── Search keywords ───────────────────────────────────────────────────────
    searchKeywords: { type: [String], default: [], select: false },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

classroomSchema.plugin(mongoosePaginate);
classroomSchema.plugin(mongooseAggregatePaginate);
classroomSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ───────────────────────────────────────────────────────────────────
classroomSchema.index(
  { searchKeywords: 'text', title: 'text', description: 'text' },
  { name: 'classroom_text_search', weights: { title: 10, searchKeywords: 8, description: 1 } },
);
classroomSchema.index({ teacherId: 1, status: 1 });
classroomSchema.index({ status: 1, 'stats.avgRating': -1 });
classroomSchema.index({ subject: 1, status: 1 });
classroomSchema.index({ status: 1, feesPaise: 1 });
classroomSchema.index({ tags: 1, status: 1 });
classroomSchema.index({ status: 1, startDate: 1 });
// For offline classroom location search
classroomSchema.index({ 'offlineFacility.location': '2dsphere' }, { sparse: true });

// ── Virtuals ───────────────────────────────────────────────────────────────────
classroomSchema.virtual('feesRupees').get(function () {
  return this.feesPaise / 100;
});
classroomSchema.virtual('isFull').get(function () {
  return this.stats.enrolledStudents >= this.maxStudents;
});
classroomSchema.virtual('progressPercent').get(function () {
  if (!this.totalHoursPlanned) return 0;
  return Math.min(100, Math.round((this.stats.hoursCompleted / this.totalHoursPlanned) * 100));
});
classroomSchema.virtual('isPastHalfway').get(function () {
  return this.stats.hoursCompleted >= this.totalHoursPlanned / 2;
});

// ── Pre-save: build search keywords ───────────────────────────────────────────
classroomSchema.pre('save', function (next) {
  if (this.isModified('title') || this.isModified('subject') || this.isModified('stream') || this.isModified('tags')) {
    const kw = [
      this.title,
      this.subject,
      this.stream,
      ...this.tags,
    ]
      .filter(Boolean)
      .flatMap((s) => s.toLowerCase().trim().split(/\s+/));
    this.searchKeywords = [...new Set(kw)];
  }
  // Validate endDate > startDate
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

// ── Instance methods ──────────────────────────────────────────────────────────
classroomSchema.methods.canAcceptStudents = function () {
  return (
    this.status === CLASSROOM_STATUS.ACTIVE &&
    this.stats.enrolledStudents < this.maxStudents
  );
};

classroomSchema.methods.canScheduleUpdate = function () {
  // Teacher can update schedule anytime but cannot reduce hours or extend duration
  return [CLASSROOM_STATUS.ACTIVE, CLASSROOM_STATUS.DRAFT].includes(this.status);
};

// ── Static methods ─────────────────────────────────────────────────────────────
/**
 * Search classrooms by topic/subject/stream with pagination.
 * Returns max 20 results as per product spec.
 */
classroomSchema.statics.search = function ({
  query,
  subject,
  mode,
  minFee,
  maxFee,
  minRating = 0,
  page  = 1,
  limit = 20,
  sort  = 'rating',
} = {}) {
  const filter = { status: CLASSROOM_STATUS.ACTIVE };

  if (subject)          filter.subject = subject;
  if (mode)             filter.mode    = mode;
  if (minRating > 0)    filter['stats.avgRating'] = { $gte: minRating };
  if (minFee || maxFee) {
    filter.feesPaise = {};
    if (minFee) filter.feesPaise.$gte = minFee * 100;
    if (maxFee) filter.feesPaise.$lte = maxFee * 100;
  }
  if (query) filter.$text = { $search: query };

  const sortMap = {
    rating:     { 'stats.avgRating': -1 },
    price_asc:  { feesPaise: 1 },
    price_desc: { feesPaise: -1 },
    new:        { createdAt: -1 },
  };

  return this.paginate(filter, {
    ...defaultPaginateOptions,
    sort:     sortMap[sort] || sortMap.rating,
    page,
    limit:    Math.min(limit, 20), // cap at 20 per product spec
    populate: { path: 'teacherId', select: 'name avatarUrl' },
    lean:     true,
    leanWithId: true,
  });
};

/**
 * Teacher's classrooms with their statuses.
 */
classroomSchema.statics.byTeacher = function (teacherId, options = {}) {
  return this.paginate(
    { teacherId },
    {
      ...defaultPaginateOptions,
      sort: { createdAt: -1 },
      ...options,
    },
  );
};

/**
 * Classrooms nearing or past their endDate without being marked completed.
 * Used by cron to auto-close.
 */
classroomSchema.statics.overdueActive = function () {
  return this.find({
    status:  CLASSROOM_STATUS.ACTIVE,
    endDate: { $lt: new Date() },
  }).lean();
};

classroomSchema.query.active = function () {
  return this.where({ status: CLASSROOM_STATUS.ACTIVE });
};

export const Classroom = mongoose.model('Classroom', classroomSchema);