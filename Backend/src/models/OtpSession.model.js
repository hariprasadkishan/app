// ─────────────────────────────────────────────────────────────────────────────
// src/models/OtpSession.model.js
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import { OTP_PURPOSE } from '../constants/enums.js';
import { phoneValidator, jsonTransform, toObjectOptions } from '../utils/schema.util.js';

const { Schema } = mongoose;

const otpSessionSchema = new Schema(
  {
    phone: {
      type:     String,
      required: true,
      trim:     true,
      validate: phoneValidator,
      index:    true,
    },
    purpose: {
      type:    String,
      enum:    Object.values(OTP_PURPOSE),
      default: OTP_PURPOSE.LOGIN,
      index:   true,
    },
    // OTP stored hashed (bcrypt) in service layer — never plaintext
    otpHash: {
      type:     String,
      required: true,
      select:   false,
    },
    expiresAt: {
      type:     Date,
      required: true,
    },
    verified:   { type: Boolean, default: false },
    verifiedAt: { type: Date,    default: null  },
    // Brute-force protection
    attemptCount: { type: Number, default: 0, min: 0, max: 10 },
    lockedUntil:  { type: Date,   default: null },
    // One-time session token issued post-OTP verify, consumed by auth middleware
    sessionToken: {
      type:   String,
      unique: true,
      sparse: true,
      select: false,
    },
    sessionTokenUsed: { type: Boolean, default: false },
    // Delivery tracking
    deliveryChannel: {
      type:    String,
      enum:    ['sms', 'whatsapp'],
      default: 'sms',
    },
    deliveryStatus: {
      type:    String,
      enum:    ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    // Rate-limit helpers
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   { virtuals: true, versionKey: false },
  },
);

// TTL index — MongoDB auto-deletes expired OTPs
otpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSessionSchema.index({ phone: 1, purpose: 1, verified: 1 });
otpSessionSchema.index({ phone: 1, createdAt: -1 });

// ── Instance methods ──────────────────────────────────────────────────────────
otpSessionSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > new Date();
};
otpSessionSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};
otpSessionSchema.methods.incrementAttempt = async function () {
  this.attemptCount += 1;
  if (this.attemptCount >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  return this.save();
};
otpSessionSchema.methods.markVerified = async function (sessionToken) {
  this.verified     = true;
  this.verifiedAt   = new Date();
  this.sessionToken = sessionToken;
  return this.save();
};
otpSessionSchema.methods.consumeSessionToken = async function () {
  this.sessionTokenUsed = true;
  return this.save();
};

// ── Static methods ─────────────────────────────────────────────────────────────
otpSessionSchema.statics.findValid = function (phone, purpose = OTP_PURPOSE.LOGIN) {
  return this.findOne({
    phone,
    purpose,
    verified:  false,
    expiresAt: { $gt: new Date() },
  })
    .select('+otpHash')
    .sort({ createdAt: -1 });
};

otpSessionSchema.statics.countRecentSends = function (phone, windowMs = 3600000) {
  return this.countDocuments({
    phone,
    createdAt: { $gte: new Date(Date.now() - windowMs) },
  });
};

export const OtpSession = mongoose.model('OtpSession', otpSessionSchema);