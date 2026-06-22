// ─────────────────────────────────────────────────────────────────────────────
// src/models/Announcement.model.js
// ─────────────────────────────────────────────────────────────────────────────
import mongoose             from 'mongoose';
import mongoosePaginate     from 'mongoose-paginate-v2';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';
import {
  jsonTransform,
  toObjectOptions,
  urlValidator,
  defaultPaginateOptions,
} from '../utils/schema.util.js';

const { Schema } = mongoose;

const announcementSchema = new Schema(
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
    body: {
      type:      String,
      required:  [true, 'Announcement body is required'],
      trim:      true,
      maxlength: [5000, 'Body cannot exceed 5000 characters'],
    },
    attachmentUrls: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5 && arr.every((u) => /^https?:\/\/.+/.test(u)),
        message:   'Max 5 attachments, must be valid URLs',
      },
    },
    // Pin to top of announcements list
    isPinned:   { type: Boolean, default: false },
    isPublished:{ type: Boolean, default: true, index: true },
    // Push notification sent?
    notified:   { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:     jsonTransform,
    toObject:   toObjectOptions,
  },
);

announcementSchema.plugin(mongoosePaginate);
announcementSchema.plugin(mongooseLeanVirtuals);

announcementSchema.index({ classroomId: 1, isPublished: 1, isPinned: -1, createdAt: -1 });

announcementSchema.statics.forClassroom = function (classroomId, options = {}) {
  return this.paginate(
    { classroomId, isPublished: true },
    {
      ...defaultPaginateOptions,
      sort:   { isPinned: -1, createdAt: -1 },
      ...options,
    },
  );
};

export const Announcement = mongoose.model('Announcement', announcementSchema);