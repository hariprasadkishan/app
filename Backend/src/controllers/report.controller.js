// src/controllers/report.controller.js
import { Report, Enrollment } from '../models/index.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler }        from '../utils/AsyncHandler.js';
import ApiError                from '../utils/ApiError.js';
import ApiResponse             from '../utils/ApiResponse.js';
import { ENROLLMENT_STATUS }   from '../constants/enums.js';
import logger                  from '../config/logger.config.js';

// ── POST /reports ─────────────────────────────────────────────────────────────
export const fileReport = asyncHandler(async (req, res) => {
  const {
    reportType, targetType, targetId,
    classroomId, description, evidenceUrls = [],
  } = req.body;

  if (!reportType || !targetType || !targetId || !description?.trim()) {
    throw ApiError.badRequest('reportType, targetType, targetId and description are required');
  }

  // If reporting within a classroom context, verify enrollment (anti-abuse)
  if (classroomId) {
    const enrolled = await Enrollment.findOne({
      studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE,
    }).lean();
    if (!enrolled) throw ApiError.forbidden('You must be enrolled in this classroom to file a report');
  }

  const report = await Report.create({
    reporterId:   req.user._id,
    reportType,
    targetType,
    targetId,
    classroomId:  classroomId || null,
    description:  description.trim(),
    evidenceUrls,
  });

  logger.warn('REPORT_FILED', {
    reportId:   report._id,
    reporterId: req.user._id,
    reportType,
    targetId,
  });

  // Non-blocking admin SMS (if configured)
  const adminPhones = (process.env.ADMIN_ALERT_PHONES || '').split(',').filter(Boolean);
  if (adminPhones.length) {
    NotificationService.notifyAdminReport(adminPhones, reportType, report._id).catch(() => {});
  }

  res.status(201).json(new ApiResponse(201, { reportId: report._id }, 'Report submitted. Our team will review it.'));
});

// ── GET /reports/my ───────────────────────────────────────────────────────────
export const getMyReports = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await Report.paginate(
    { reporterId: req.user._id },
    {
      page: Number(page), limit: Math.min(Number(limit), 50),
      sort: { createdAt: -1 },
      select: '-adminNotes',
    },
  );

  res.status(200).json(new ApiResponse(200, result, 'Your reports'));
});