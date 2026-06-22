// ─────────────────────────────────────────────────────────────────────────────
// src/models/Material.model.js
//
// Teacher can post study materials (PDFs, PPTs, links, etc.) in their classroom.
// Enrolled students can access them.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import { MATERIAL_TYPE }    from '../constants/enums.js';
import {
  jsonTransform,
  toObjectOptions,
  urlValidator,
  enumField,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

const materialSchema = new Schema(
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
    description: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default:   '',
    },
    type: enumField(MATERIAL_TYPE, MATERIAL_TYPE.PDF),
    // For file types (pdf, ppt, image, document, video)
    fileUrl: {
      type:     String,
      trim:     true,
      validate: urlValidator,
      default:  null,
    },
    s3Key: {
      type:   String,
      trim:   true,
      select: false,
    },
    fileSizeBytes: { type: Number, default: null },
    mimeType:      { type: String, trim: true, default: null },
    // For link type
    externalUrl: {
      type:     String,
      trim:     true,
      validate: urlValidator,
      default:  null,
    },
    // Visibility: published or draft
    isPublished:  { type: Boolean, default: true, index: true },
    // Topic/chapter tag for organising
    topic: {
      type:    String,
      trim:    true,
      default: '',
    },
    viewCount:     { type: Number, default: 0, min: 0 },
    downloadCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

materialSchema.plugin(mongoosePaginate);
materialSchema.plugin(mongooseLeanVirtuals);

materialSchema.index({ classroomId: 1, isPublished: 1, createdAt: -1 });
materialSchema.index({ teacherId: 1, classroomId: 1 });
materialSchema.index({ classroomId: 1, topic: 1 });

// ── Static methods ─────────────────────────────────────────────────────────────
materialSchema.statics.forClassroom = function (classroomId, options = {}) {
  return this.paginate(
    { classroomId, isPublished: true },
    {
      ...defaultPaginateOptions,
      sort: { createdAt: -1 },
      ...options,
    },
  );
};

export const Material = mongoose.model('Material', materialSchema);