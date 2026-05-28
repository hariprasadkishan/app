// ─────────────────────────────────────────────────────────────────────────────
// src/utils/schema.utils.js
// Reusable schema fragments, helpers, and transforms.
// Import these into every model to maintain consistency.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Shared JSON transform ────────────────────────────────────────────────────
// Strips __v and renames _id → id on every toJSON call.
// Apply via: schema.set('toJSON', jsonTransform)
export const jsonTransform = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    // Strip sensitive / internal fields added per-model
    delete ret.__sensitiveFields;
    return ret;
  },
};

export const toObjectOptions = {
  virtuals: true,
  versionKey: false,
};

// ── Audit sub-document ───────────────────────────────────────────────────────
// Embed in any schema needing admin audit trail.
export const auditSchema = new Schema(
  {
    reviewedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },
    reviewNote:  { type: String, trim: true, default: '' },
    adminAction: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

// ── GeoPoint sub-document ────────────────────────────────────────────────────
// GeoJSON Point — use for 2dsphere index on teacher location.
export const geoPointSchema = new Schema(
  {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number], // [longitude, latitude]
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length === 2
            && v[0] >= -180 && v[0] <= 180
            && v[1] >= -90  && v[1] <= 90;
        },
        message: 'Invalid GeoJSON coordinates [lng, lat]',
      },
    },
  },
  { _id: false },
);

// ── Money field helper ───────────────────────────────────────────────────────
// Always store monetary values in PAISE (smallest currency unit).
// Never store floats for money.
export function moneyField(opts = {}) {
  return {
    type:    Number,
    min:     [0, 'Amount cannot be negative'],
    default: 0,
    ...opts,
  };
}

// ── Phone validator ──────────────────────────────────────────────────────────
export const phoneValidator = {
  validator: (v) => /^\+?[1-9]\d{9,14}$/.test(v),
  message:   (props) => `${props.value} is not a valid phone number`,
};

// ── URL validator ────────────────────────────────────────────────────────────
export const urlValidator = {
  validator: (v) => !v || /^https?:\/\/.+/.test(v),
  message:   'Must be a valid URL',
};

// ── Pagination default options ───────────────────────────────────────────────
// Use with mongoose-paginate-v2
export const defaultPaginateOptions = {
  lean:          true,
  leanWithId:    true,
  customLabels: {
    docs:       'results',
    totalDocs:  'total',
    totalPages: 'pages',
    nextPage:   'next',
    prevPage:   'prev',
    pagingCounter: 'fromIndex',
  },
};

// ── Apply standard plugins ───────────────────────────────────────────────────
// Call this in each model file after defining schema.
export function applySchemaPlugins(schema, plugins = []) {
  plugins.forEach((p) => {
    if (Array.isArray(p)) schema.plugin(p[0], p[1]);
    else schema.plugin(p);
  });
}

// ── Safe enum builder ────────────────────────────────────────────────────────
// Usage: enumField(BOOKING_STATUS, 'pending')
export function enumField(enumObj, defaultVal, required = true) {
  return {
    type:     String,
    enum:     { values: Object.values(enumObj), message: `{VALUE} is not a valid status` },
    default:  defaultVal,
    required,
  };
}


/**
 * Helper to check if a document or OTP session has expired
 * @param {Date} expiryDate 
 * @returns {Boolean} true if expired
 */
export const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  return new Date() > new Date(expiryDate);
};