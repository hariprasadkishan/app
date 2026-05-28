// ─────────────────────────────────────────────────────────────────────────────
// src/models/User.model.js
//
// Architecture decisions:
//  • Single collection for student/teacher/admin — role discriminates behaviour.
//  • Keeps auth surface minimal; sensitive profile lives in TeacherProfile.
//  • "credits" field is reserved for future wallet/referral system.
//  • fcmToken / pushTokens are stored here for future notification cron.
//  • lastActiveAt drives engagement analytics without extra collection.
//  • Sparse unique index on email — students may skip email entirely.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose              from 'mongoose';
import mongoosePaginate      from 'mongoose-paginate-v2';
import mongooseLeanVirtuals  from 'mongoose-lean-virtuals';

import { ROLES }                            from '../constants/enums.js';
import { jsonTransform, toObjectOptions,
         phoneValidator, urlValidator,
         defaultPaginateOptions }           from '../utils/schema.utils.js';

const { Schema } = mongoose;

// ── Schema ───────────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    phone: {
      type:      String,
      required:  [true, 'Phone is required'],
      unique:    true,
      trim:      true,
      validate:  phoneValidator,
      index:     true,
    },
    role: {
      type:     String,
      enum:     { values: Object.values(ROLES), message: '{VALUE} is not a valid role' },
      required: [true, 'Role is required'],
      index:    true,
    },
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type:      String,
      trim:      true,
      lowercase: true,
      sparse:    true,    // unique but nullable
      unique:    true,
      validate: {
        validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message:   'Invalid email address',
      },
    },
    avatarUrl: {
      type:     String,
      trim:     true,
      validate: urlValidator,
      default:  null,
    },

    // ── Auth flags ────────────────────────────────────────────────────────────
    isPhoneVerified: { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true,  index: true },
    isBanned:        { type: Boolean, default: false, index: true },
    banReason:       { type: String,  trim: true,     default: null },

    // ── Engagement / notifications ────────────────────────────────────────────
    lastActiveAt:    { type: Date, default: null, index: true },
    fcmTokens: {                                     // supports multi-device
      type:    [String],
      default: [],
      select:  false,                                // never leak push tokens
    },

    // ── Future wallet stub ────────────────────────────────────────────────────
    walletBalance: {                                 // in paise
      type:    Number,
      default: 0,
      min:     [0, 'Wallet balance cannot be negative'],
    },

    // ── Admin meta ────────────────────────────────────────────────────────────
    onboardedAt:  { type: Date, default: null },
    deletedAt:    { type: Date, default: null, index: true },  // soft-delete
  },
  {
    timestamps:  true,
    toJSON:      jsonTransform,
    toObject:    toObjectOptions,
  },
);

// ── Plugins ──────────────────────────────────────────────────────────────────

mongoosePaginate.paginate.options = defaultPaginateOptions;
userSchema.plugin(mongoosePaginate);
userSchema.plugin(mongooseLeanVirtuals);

// ── Compound indexes ─────────────────────────────────────────────────────────

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ isBanned: 1, role: 1 });
userSchema.index({ deletedAt: 1 }, { sparse: true });

// ── Virtuals ─────────────────────────────────────────────────────────────────

userSchema.virtual('isDeleted').get(function () {
  return this.deletedAt !== null;
});

userSchema.virtual('displayName').get(function () {
  return this.name || `User_${this._id.toString().slice(-6)}`;
});

// ── Instance methods ─────────────────────────────────────────────────────────

userSchema.methods.softDelete = async function () {
  this.deletedAt = new Date();
  this.isActive  = false;
  return this.save();
};

userSchema.methods.ban = async function (reason) {
  this.isBanned  = true;
  this.banReason = reason || 'Policy violation';
  this.isActive  = false;
  return this.save();
};

userSchema.methods.touchActivity = function () {
  this.lastActiveAt = new Date();
  // use updateOne to avoid full document round-trip in hot paths
  return this.constructor.updateOne({ _id: this._id }, { lastActiveAt: new Date() });
};

// ── Static methods ────────────────────────────────────────────────────────────

userSchema.statics.findByPhone = function (phone) {
  return this.findOne({ phone: phone.trim(), deletedAt: null });
};

userSchema.statics.findActiveById = function (id) {
  return this.findOne({ _id: id, isActive: true, deletedAt: null });
};

/**
 * Admin: paginated user list with role filter
 * @param {object} filter - mongoose filter
 * @param {object} options - paginate options
 */
userSchema.statics.listPaginated = function (filter = {}, options = {}) {
  const safeFilter = { deletedAt: null, ...filter };
  return this.paginate(safeFilter, {
    ...defaultPaginateOptions,
    sort:   options.sort   || { createdAt: -1 },
    page:   options.page   || 1,
    limit:  options.limit  || 20,
    select: options.select || '-fcmTokens -walletBalance',
    ...options,
  });
};

/**
 * Analytics: user signup counts grouped by role & date
 */
userSchema.statics.signupAnalytics = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt:  { $gte: startDate, $lte: endDate },
        deletedAt:  null,
      },
    },
    {
      $group: {
        _id:   { role: '$role', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);
};

// ── Middleware hooks ─────────────────────────────────────────────────────────

// Set onboardedAt once on first activation
userSchema.pre('save', function (next) {
  if (this.isNew) {
    this.onboardedAt = new Date();
  }
  next();
});

// Prevent saving banned/deleted users as active
userSchema.pre('save', function (next) {
  if ((this.isBanned || this.deletedAt) && this.isActive) {
    this.isActive = false;
  }
  next();
});

// ── Query helpers ─────────────────────────────────────────────────────────────

userSchema.query.active = function () {
  return this.where({ isActive: true, deletedAt: null });
};

userSchema.query.byRole = function (role) {
  return this.where({ role });
};

// ─────────────────────────────────────────────────────────────────────────────
export const User = mongoose.model('User', userSchema);