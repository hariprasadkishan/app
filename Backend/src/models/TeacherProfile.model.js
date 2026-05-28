// ─────────────────────────────────────────────────────────────────────────────
// src/models/TeacherProfile.model.js
//
// Architecture decisions:
//  • Separate collection from User — keeps user doc lean; profile is heavy.
//  • GeoJSON Point for 2dsphere index → $near / $geoWithin tutor search.
//  • availableSlots stored as lightweight sub-docs for fast conflict checking.
//  • Rating/reviewCount denormalised here for O(1) sort — updated via trigger.
//  • All monetary values (hourlyRate) in PAISE to avoid float precision bugs.
//  • searchKeywords[] is a pre-computed field (populated in pre-save hook)
//    used for a text index — avoids expensive regex on subject/name.
//  • stats sub-doc is updated via atomic $inc in service layer — never
//    recalculated on every read.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose                      from 'mongoose';
import mongoosePaginate              from 'mongoose-paginate-v2';
import mongooseAggregatePaginate     from 'mongoose-aggregate-paginate-v2';
import mongooseLeanVirtuals          from 'mongoose-lean-virtuals';

import {
  VERIFICATION_STATUS,
  SUBJECTS,
  CLASS_GRADES,
  INDIAN_BOARDS,
}                                    from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  geoPointSchema,
  moneyField,
  urlValidator,
  defaultPaginateOptions,
  enumField,
}                                    from '../utils/schema.utils.js';

const { Schema } = mongoose;

// ── Available Slot sub-document ───────────────────────────────────────────────
// Stores recurring weekly availability slots.
// day: 0=Sunday … 6=Saturday (matches JS Date.getDay())
const availableSlotSchema = new Schema(
  {
    day:           { type: Number, required: true, min: 0, max: 6 },
    startTime:     { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }, // "HH:MM"
    endTime:       { type: String, required: true, match: /^([01]\d|2[0-3]):([0-5]\d)$/ },
    slotDuration:  { type: Number, default: 60, enum: [30, 60, 90, 120] }, // minutes
    isBooked:      { type: Boolean, default: false },
    bookedBy:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true },  // _id: true so we can reference individual slots in bookings
);

// ── Stats sub-document ────────────────────────────────────────────────────────
// Denormalised counters; updated via atomic $inc — never via findById+save.
const teacherStatsSchema = new Schema(
  {
    totalBookings:     { type: Number, default: 0, min: 0 },
    completedSessions: { type: Number, default: 0, min: 0 },
    cancelledSessions: { type: Number, default: 0, min: 0 },
    totalEarningsPaise:{ type: Number, default: 0, min: 0 }, // lifetime earnings in paise
    pendingPayoutPaise:{ type: Number, default: 0, min: 0 },
    avgRating:         { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:       { type: Number, default: 0, min: 0 },
    responseTimeAvgMs: { type: Number, default: null },      // for "response time" badge
  },
  { _id: false },
);

// ── Main TeacherProfile schema ────────────────────────────────────────────────

const teacherProfileSchema = new Schema(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Bio & professional ────────────────────────────────────────────────────
    bio: {
      type:      String,
      trim:      true,
      maxlength: [1200, 'Bio cannot exceed 1200 characters'],
      default:   '',
    },
    headline: {                             // e.g. "IIT Alumni | 8 yrs Maths"
      type:      String,
      trim:      true,
      maxlength: [160, 'Headline cannot exceed 160 characters'],
      default:   '',
    },
    experienceYears: {
      type:    Number,
      min:     [0, 'Experience cannot be negative'],
      max:     [60, 'Experience exceeds reasonable value'],
      default: 0,
    },
    education: [
      {
        institution: { type: String, trim: true },
        degree:      { type: String, trim: true },
        year:        { type: Number, min: 1950, max: new Date().getFullYear() },
      },
    ],

    // ── Teaching meta ─────────────────────────────────────────────────────────
    subjects: {
      type:     [String],
      enum:     { values: SUBJECTS, message: '{VALUE} is not a valid subject' },
      required: [true, 'At least one subject is required'],
      validate: {
        validator: (v) => v.length > 0 && v.length <= 10,
        message:   'Subjects must be between 1 and 10',
      },
    },
    classGrades: {
      type:     [String],
      enum:     { values: CLASS_GRADES, message: '{VALUE} is not a valid class grade' },
      default:  [],
      validate: {
        validator: (v) => v.length <= 15,
        message:   'Cannot exceed 15 class grades',
      },
    },
    boards: {
      type:    [String],
      enum:    { values: INDIAN_BOARDS, message: '{VALUE} is not a valid board' },
      default: [],
    },
    languages: {
      type:    [String],
      default: ['Hindi', 'English'],
    },

    // ── Pricing ───────────────────────────────────────────────────────────────
    hourlyRatePaise: {
      ...moneyField({ required: [true, 'Hourly rate is required'] }),
      min: [5000, 'Minimum rate is ₹50'],   // ₹50 minimum
    },

    // ── Location ──────────────────────────────────────────────────────────────
    location: {
      type:    geoPointSchema,
      default: null,
      index:   '2dsphere',
    },
    city:    { type: String, trim: true, lowercase: true, default: null, index: true },
    state:   { type: String, trim: true, lowercase: true, default: null },
    country: { type: String, trim: true, lowercase: true, default: 'india' },

    // ── Availability ──────────────────────────────────────────────────────────
    isAvailable:    { type: Boolean, default: false, index: true },
    availableSlots: { type: [availableSlotSchema], default: [] },
    onlineOnly:     { type: Boolean, default: true },     // online vs in-person

    // ── KYC / Verification ────────────────────────────────────────────────────
    verificationStatus: enumField(VERIFICATION_STATUS, VERIFICATION_STATUS.PENDING),
    verifiedAt:         { type: Date, default: null },
    rejectionReason:    { type: String, trim: true, default: null },
    kycDocumentIds:     [{ type: Schema.Types.ObjectId, ref: 'Document' }],

    // ── Media ─────────────────────────────────────────────────────────────────
    introVideoUrl:   {
      type:     String,
      trim:     true,
      validate: urlValidator,
      default:  null,
    },
    portfolioUrls: {
      type:     [String],
      validate: {
        validator: (arr) => arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'All portfolio links must be valid URLs',
      },
      default: [],
    },

    // ── Search optimisation ───────────────────────────────────────────────────
    // Pre-computed text keywords for text index (populated in pre-save hook)
    searchKeywords: { type: [String], default: [], select: false },

    // ── Denormalised stats ────────────────────────────────────────────────────
    stats: { type: teacherStatsSchema, default: () => ({}) },

    // ── Admin credits / feature flags ─────────────────────────────────────────
    isFeatured:     { type: Boolean, default: false, index: true },
    featuredUntil:  { type: Date,    default: null },
    adminNotes:     { type: String,  trim: true, default: null, select: false },
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

teacherProfileSchema.plugin(mongoosePaginate);
teacherProfileSchema.plugin(mongooseAggregatePaginate);
teacherProfileSchema.plugin(mongooseLeanVirtuals);

// ── Indexes ──────────────────────────────────────────────────────────────────

// Text search index — used by $text operator in search service
teacherProfileSchema.index(
  { searchKeywords: 'text', headline: 'text', bio: 'text' },
  { name: 'teacher_text_search', weights: { searchKeywords: 10, headline: 5, bio: 1 } },
);

// Core tutor-search compound index (filter → sort pipeline)
teacherProfileSchema.index({
  verificationStatus: 1,
  isAvailable:        1,
  subjects:           1,
  classGrades:        1,
  city:               1,
});

teacherProfileSchema.index({ verificationStatus: 1, 'stats.avgRating': -1 });
teacherProfileSchema.index({ verificationStatus: 1, hourlyRatePaise:    1 });
teacherProfileSchema.index({ verificationStatus: 1, createdAt:         -1 });
teacherProfileSchema.index({ isFeatured: 1, featuredUntil: 1 }, { sparse: true });
teacherProfileSchema.index({ location: '2dsphere' });   // geo search

// ── Virtuals ─────────────────────────────────────────────────────────────────

teacherProfileSchema.virtual('hourlyRateRupees').get(function () {
  return this.hourlyRatePaise / 100;
});

teacherProfileSchema.virtual('isVerified').get(function () {
  return this.verificationStatus === VERIFICATION_STATUS.APPROVED;
});

teacherProfileSchema.virtual('completionRate').get(function () {
  const s = this.stats;
  if (!s || !s.totalBookings) return 0;
  return Math.round((s.completedSessions / s.totalBookings) * 100);
});

// ── Pre-save hook — build search keywords ────────────────────────────────────

teacherProfileSchema.pre('save', function (next) {
  if (
    this.isModified('subjects') ||
    this.isModified('classGrades') ||
    this.isModified('boards') ||
    this.isModified('languages') ||
    this.isModified('city')
  ) {
    const kw = [
      ...this.subjects,
      ...this.classGrades,
      ...this.boards,
      ...this.languages,
      this.city,
    ]
      .filter(Boolean)
      .map((s) => s.toLowerCase().trim());

    this.searchKeywords = [...new Set(kw)];
  }
  next();
});

// ── Instance methods ─────────────────────────────────────────────────────────

teacherProfileSchema.methods.isSlotAvailable = function (day, startTime) {
  return this.availableSlots.some(
    (s) => s.day === day && s.startTime === startTime && !s.isBooked,
  );
};

teacherProfileSchema.methods.markSlotBooked = function (slotId, studentId) {
  const slot = this.availableSlots.id(slotId);
  if (!slot) throw new Error('Slot not found');
  if (slot.isBooked) throw new Error('Slot already booked');
  slot.isBooked = true;
  slot.bookedBy = studentId;
  return this.save();
};

teacherProfileSchema.methods.releaseSlot = function (slotId) {
  const slot = this.availableSlots.id(slotId);
  if (slot) {
    slot.isBooked = false;
    slot.bookedBy = null;
  }
  return this.save();
};

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * Full-featured teacher search with geo, text, filters.
 * Called by SearchService — returns paginated lean results.
 */
teacherProfileSchema.statics.search = function ({
  subjects,
  classGrades,
  city,
  minRate,
  maxRate,
  nearLng,
  nearLat,
  maxDistanceKm = 50,
  minRating = 0,
  textQuery,
  page  = 1,
  limit = 20,
  sort  = 'rating',  // 'rating' | 'price_asc' | 'price_desc' | 'new'
} = {}) {
  const filter = {
    verificationStatus: VERIFICATION_STATUS.APPROVED,
    isAvailable:        true,
  };

  if (subjects?.length)    filter.subjects    = { $in: subjects };
  if (classGrades?.length) filter.classGrades = { $in: classGrades };
  if (city)                filter.city        = city.toLowerCase();
  if (minRate || maxRate) {
    filter.hourlyRatePaise = {};
    if (minRate) filter.hourlyRatePaise.$gte = minRate * 100;
    if (maxRate) filter.hourlyRatePaise.$lte = maxRate * 100;
  }
  if (minRating > 0) filter['stats.avgRating'] = { $gte: minRating };
  if (textQuery)     filter.$text = { $search: textQuery };

  // Geo filter overrides city when coordinates provided
  if (nearLng != null && nearLat != null) {
    filter.location = {
      $near: {
        $geometry:    { type: 'Point', coordinates: [nearLng, nearLat] },
        $maxDistance: maxDistanceKm * 1000,
      },
    };
  }

  const sortMap = {
    rating:     { 'stats.avgRating': -1 },
    price_asc:  { hourlyRatePaise: 1 },
    price_desc: { hourlyRatePaise: -1 },
    new:        { createdAt: -1 },
  };

  return this.paginate(filter, {
    ...defaultPaginateOptions,
    sort:    sortMap[sort] || sortMap.rating,
    page,
    limit,
    populate: { path: 'userId', select: 'name avatarUrl phone' },
    lean:     true,
    leanWithId: true,
  });
};

/**
 * Admin: paginated verification queue
 */
teacherProfileSchema.statics.pendingVerification = function (options = {}) {
  return this.paginate(
    { verificationStatus: VERIFICATION_STATUS.PENDING },
    {
      ...defaultPaginateOptions,
      sort:     { createdAt: 1 },   // FIFO
      populate: { path: 'userId', select: 'name phone email' },
      ...options,
    },
  );
};

/**
 * Analytics: top earning teachers (used in admin dashboard)
 */
teacherProfileSchema.statics.topEarners = function (limit = 10) {
  return this.aggregate([
    { $match: { verificationStatus: VERIFICATION_STATUS.APPROVED } },
    { $sort:  { 'stats.totalEarningsPaise': -1 } },
    { $limit: limit },
    {
      $lookup: {
        from:         'users',
        localField:   'userId',
        foreignField: '_id',
        as:           'user',
        pipeline:     [{ $project: { name: 1, phone: 1, avatarUrl: 1 } }],
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        userId:               1,
        user:                 1,
        totalEarningsRupees:  { $divide: ['$stats.totalEarningsPaise', 100] },
        completedSessions:    '$stats.completedSessions',
        avgRating:            '$stats.avgRating',
      },
    },
  ]);
};

// ── Query helpers ─────────────────────────────────────────────────────────────

teacherProfileSchema.query.approved = function () {
  return this.where({ verificationStatus: VERIFICATION_STATUS.APPROVED });
};

teacherProfileSchema.query.available = function () {
  return this.where({ isAvailable: true });
};

// ─────────────────────────────────────────────────────────────────────────────
export const TeacherProfile = mongoose.model('TeacherProfile', teacherProfileSchema);