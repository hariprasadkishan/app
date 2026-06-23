// src/controllers/extraClass.controller.js
import { ExtraClass, Classroom, Enrollment } from '../models/index.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler }        from '../utils/AsyncHandler.js';
import ApiError                from '../utils/ApiError.js';
import ApiResponse             from '../utils/ApiResponse.js';
import { EXTRA_CLASS_STATUS, CLASSROOM_STATUS, ENROLLMENT_STATUS } from '../constants/enums.js';
import logger                  from '../config/logger.config.js';

// ── POST /classrooms/:classroomId/extra-classes ───────────────────────────────
export const requestExtraClass = asyncHandler(async (req, res) => {
  const { classroomId }          = req.params;
  const { scheduledAt, durationMinutes, reason, gmeetLink } = req.body;

  if (!scheduledAt || !durationMinutes || !reason?.trim()) {
    throw ApiError.badRequest('scheduledAt, durationMinutes and reason are required');
  }
  if (new Date(scheduledAt) <= new Date()) {
    throw ApiError.badRequest('scheduledAt must be in the future');
  }
  if (Number(durationMinutes) < 15 || Number(durationMinutes) > 480) {
    throw ApiError.badRequest('durationMinutes must be between 15 and 480');
  }

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');
  if (classroom.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('Only the classroom teacher can request extra classes');
  }
  if (classroom.status !== CLASSROOM_STATUS.ACTIVE) {
    throw ApiError.badRequest('Classroom must be active to request extra classes');
  }

  const extraClass = await ExtraClass.create({
    classroomId,
    teacherId:       req.user._id,
    scheduledAt:     new Date(scheduledAt),
    durationMinutes: Number(durationMinutes),
    reason:          reason.trim(),
    gmeetLink:       gmeetLink?.trim() || classroom.gmeetLink || null,
    status:          EXTRA_CLASS_STATUS.PENDING,
  });

  logger.info('Extra class requested', { classroomId, extraClassId: extraClass._id, teacherId: req.user._id });
  res.status(201).json(new ApiResponse(201, extraClass, 'Extra class request submitted for admin review'));
});

// ── GET /classrooms/:classroomId/extra-classes ────────────────────────────────
export const getExtraClasses = asyncHandler(async (req, res) => {
  const { classroomId }   = req.params;
  const { page = 1, limit = 20, status } = req.query;

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');

  const isTeacher = req.user?.role === 'teacher' && classroom.teacherId.toString() === req.user._id.toString();

  if (!isTeacher) {
    const enrolled = await Enrollment.findOne({ studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE }).lean();
    if (!enrolled) throw ApiError.forbidden('You must be enrolled to view extra classes');
  }

  const filter = { classroomId };
  if (status) filter.status = status;
  else filter.status = EXTRA_CLASS_STATUS.APPROVED; // Students see only approved

  if (isTeacher) delete filter.status; // Teachers see all statuses

  const result = await ExtraClass.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 50),
    sort: { scheduledAt: 1 },
  });

  res.status(200).json(new ApiResponse(200, result, 'Extra classes'));
});