// src/controllers/classroom.controller.js
import mongoose from 'mongoose';
import {
  Classroom, TeacherProfile, Enrollment, Poll, EnrollmentQuery, Review,
} from '../models/index.js';
import { ClassroomService }  from '../services/classroom.service.js';
import { CloudinaryService } from '../services/cloudinary.service.js';
import { asyncHandler }      from '../utils/AsyncHandler.js';
import ApiError              from '../utils/ApiError.js';
import ApiResponse           from '../utils/ApiResponse.js';
import { CLASSROOM_STATUS, CLASSROOM_MODE, POLL_TYPE } from '../constants/enums.js';
import { CLOUDINARY_FOLDERS } from '../constants/app.constants.js';
import logger                from '../config/logger.config.js';

// ── POST / — Create classroom ─────────────────────────────────────────────────
export const createClassroom = asyncHandler(async (req, res) => {
  const {
    title, subject, stream, description, tags,
    feesPaise, totalHoursPlanned, startDate, endDate,
    schedule, maxStudents, mode,
    offlineFacility,
  } = req.body;

  // Validate required fields
  if (!title || !subject || !feesPaise || !totalHoursPlanned || !startDate || !endDate || !schedule || !maxStudents) {
    throw ApiError.badRequest('title, subject, feesPaise, totalHoursPlanned, startDate, endDate, schedule, maxStudents are required');
  }

  // Validate schedule slots
  ClassroomService.validateScheduleSlots(schedule);

  // Offline validation
  if (mode === CLASSROOM_MODE.OFFLINE) {
    ClassroomService.validateOfflineFields({ mode, offlineAddress: offlineFacility?.address });
  }

  // Parse and validate dates
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (end <= start) throw ApiError.badRequest('End date must be after start date');
  if (start < new Date()) throw ApiError.badRequest('Start date cannot be in the past');

  // Map schedule day field name (frontend may send dayOfWeek vs day)
  const normalizedSchedule = schedule.map((slot) => ({
    day:             slot.day ?? slot.dayOfWeek,
    startTime:       slot.startTime,
    endTime:         slot.endTime || slot.startTime, // fallback
    durationMinutes: slot.durationMinutes,
  }));

  // Generate GMeet link for online classrooms
  const tempId   = new mongoose.Types.ObjectId();
  const gmeetLink = mode !== CLASSROOM_MODE.OFFLINE
    ? ClassroomService.generateMeetLink(tempId.toString())
    : null;

  const classroom = await Classroom.create({
    _id:              tempId,
    teacherId:        req.user._id,
    title:            title.trim(),
    subject:          subject.trim(),
    stream:           stream?.trim()      || null,
    description:      description?.trim() || '',
    tags:             tags                || [],
    feesPaise:        Math.round(Number(feesPaise)),
    totalHoursPlanned: Number(totalHoursPlanned),
    startDate:        start,
    endDate:          end,
    schedule:         normalizedSchedule,
    maxStudents:      Number(maxStudents),
    mode:             mode || CLASSROOM_MODE.ONLINE,
    offlineFacility:  mode === CLASSROOM_MODE.OFFLINE ? offlineFacility : null,
    gmeetLink,
    status:           CLASSROOM_STATUS.ACTIVE,
  });

  // Update teacher stats
  await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $inc: { 'stats.totalClassrooms': 1, 'stats.activeClassrooms': 1 } },
  );

  logger.info('Classroom created', { classroomId: classroom._id, teacherId: req.user._id });
  res.status(201).json(new ApiResponse(201, classroom, 'Classroom created'));
});

// ── PATCH /:classroomId — Update classroom ────────────────────────────────────
export const updateClassroom = asyncHandler(async (req, res) => {
  const classroom = req.resource; // set by checkOwnership middleware

  const {
    title, description, tags, schedule,
    totalHoursPlanned, endDate, maxStudents,
    offlineFacility,
  } = req.body;

  // Enforce immutable constraints
  ClassroomService.validateScheduleUpdate(classroom, {
    totalPlannedHours: totalHoursPlanned,
    endDate,
  });

  if (!classroom.canScheduleUpdate()) {
    throw ApiError.badRequest(`Cannot update classroom in status: ${classroom.status}`);
  }

  if (schedule) ClassroomService.validateScheduleSlots(schedule);

  const updates = {};
  if (title)             updates.title             = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (tags)              updates.tags               = tags;
  if (schedule)          updates.schedule           = schedule;
  if (offlineFacility)   updates.offlineFacility    = offlineFacility;
  if (maxStudents)       updates.maxStudents        = Number(maxStudents);

  const updated = await Classroom.findByIdAndUpdate(
    classroom._id,
    { $set: updates },
    { new: true, runValidators: true },
  );

  res.status(200).json(new ApiResponse(200, updated, 'Classroom updated'));
});

// ── GET /search — Marketplace search ─────────────────────────────────────────
export const searchClassrooms = asyncHandler(async (req, res) => {
  const { query, subject, mode, minFee, maxFee, minRating, sort, page = 1 } = req.query;

  const result = await Classroom.search({
    query,
    subject,
    mode,
    minFee:    minFee    ? Number(minFee)    : undefined,
    maxFee:    maxFee    ? Number(maxFee)    : undefined,
    minRating: minRating ? Number(minRating) : 0,
    sort,
    page:      Number(page),
    limit:     20,
  });

  res.status(200).json(new ApiResponse(200, result, 'Search results'));
});

// ── GET /:classroomId — Classroom detail ──────────────────────────────────────
export const getClassroomDetail = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;

  const [classroom, reviews, ratingBreakdown] = await Promise.all([
    Classroom.findById(classroomId)
      .populate('teacherId', 'name avatarUrl city state')
      .lean({ virtuals: true }),
    Review.publicClassroomReviews(classroomId, { limit: 5 }),
    Review.ratingBreakdown(classroomId),
  ]);

  if (!classroom) throw ApiError.notFound('Classroom');

  // Hide GMeet link from unauthenticated / non-enrolled users
  let enrollmentStatus = null;
  if (req.user) {
    if (req.user.role === 'student') {
      const enrollment = await Enrollment.findOne({
        studentId:   req.user._id,
        classroomId,
        status:      'active',
      }).lean();
      enrollmentStatus = enrollment ? 'enrolled' : null;

      if (!enrollment) {
        classroom.gmeetLink = undefined;
        classroom.schedule?.forEach((s) => { s.gmeetLink = undefined; });
      }
    }
  } else {
    classroom.gmeetLink = undefined;
    classroom.schedule?.forEach((s) => { s.gmeetLink = undefined; });
  }

  res.status(200).json(new ApiResponse(200, {
    classroom, reviews, ratingBreakdown, enrollmentStatus,
  }, 'Classroom detail'));
});

// ── POST /:classroomId/early-end ──────────────────────────────────────────────
export const requestEarlyEnd = asyncHandler(async (req, res) => {
  const classroom = req.resource;

  if (classroom.status !== CLASSROOM_STATUS.ACTIVE) {
    throw ApiError.badRequest(`Cannot request early end for classroom in status: ${classroom.status}`);
  }

  const isAfterMidpoint = ClassroomService.isAfterMidpoint(
    classroom.stats.hoursCompleted,
    classroom.totalHoursPlanned,
  );
  if (!isAfterMidpoint) {
    throw new ApiError(400, 'Cannot request early end before completing 50% of planned hours', [], 'MIDPOINT_NOT_REACHED');
  }

  const enrolledStudents = await Enrollment.countDocuments({
    classroomId: classroom._id, status: 'active',
  });
  if (enrolledStudents === 0) {
    throw ApiError.badRequest('No enrolled students to vote');
  }

  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

  const poll = await Poll.create({
    classroomId:   classroom._id,
    teacherId:     req.user._id,
    type:          POLL_TYPE.EARLY_END,
    question:      'Do you approve ending this course early?',
    options:       [{ text: 'Yes, I approve' }, { text: 'No, continue' }],
    expiresAt,
  });

  await Classroom.findByIdAndUpdate(classroom._id, {
    status:               CLASSROOM_STATUS.COMPLETION_PENDING,
    earlyEndRequestedAt:  new Date(),
    earlyEndPollId:       poll._id,
  });

  logger.info('Early end requested', { classroomId: classroom._id, pollId: poll._id });
  res.status(201).json(new ApiResponse(201, { poll }, 'Early-end vote initiated'));
});

// ── POST /:classroomId/media — Upload offline classroom media ─────────────────
export const uploadClassroomMedia = asyncHandler(async (req, res) => {
  const classroom = req.resource;
  if (classroom.mode !== CLASSROOM_MODE.OFFLINE) {
    throw ApiError.badRequest('Media upload is only for offline classrooms');
  }
  if (!req.files) throw ApiError.badRequest('No files uploaded');

  const photos = req.files.photos || [];
  const videos = req.files.videos || [];

  const uploadedPhotos = await Promise.all(
    photos.map((f, i) => CloudinaryService.uploadClassroomMedia(f.buffer, classroom._id, `photo_${i}`))
  );
  const uploadedVideos = await Promise.all(
    videos.map((f, i) => CloudinaryService.uploadClassroomMedia(f.buffer, classroom._id, `video_${i}`))
  );

  const photoUrls = uploadedPhotos.map((r) => r.secure_url);
  const videoUrls = uploadedVideos.map((r) => r.secure_url);

  await Classroom.findByIdAndUpdate(classroom._id, {
    $push: {
      'offlineFacility.photoUrls': { $each: photoUrls },
      'offlineFacility.videoUrls': { $each: videoUrls },
    },
  });

  res.status(200).json(new ApiResponse(200, { photoUrls, videoUrls }, 'Media uploaded'));
});

// ── POST /:classroomId/vote-early-end — Student votes on early end ────────────
export const voteEarlyEnd = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { approve }     = req.body;

  if (typeof approve !== 'boolean') {
    throw ApiError.badRequest('approve must be a boolean');
  }

  // Verify student is enrolled
  const enrollment = await Enrollment.findOne({
    studentId:   req.user._id,
    classroomId,
    status:      'active',
  });
  if (!enrollment) throw ApiError.forbidden('You are not enrolled in this classroom');

  if (enrollment.earlyEndVote !== null && enrollment.earlyEndVote !== undefined) {
    throw new ApiError(409, 'You have already voted', [], 'ALREADY_VOTED');
  }

  await enrollment.castEarlyEndVote(approve);

  // Check if threshold reached
  const summary = await Enrollment.earlyEndVoteSummary(classroomId);
  const approved = ClassroomService.isEarlyEndApproved(summary.approveCount, summary.total);

  if (approved) {
    await Classroom.findByIdAndUpdate(classroomId, {
      status:            CLASSROOM_STATUS.COMPLETED,
      completedAt:       new Date(),
      completionCase:    'case_1',
      earlyEndApprovedAt: new Date(),
    });
    // Close the poll
    const classroom = await Classroom.findById(classroomId);
    if (classroom?.earlyEndPollId) {
      const poll = await Poll.findById(classroom.earlyEndPollId);
      if (poll) await poll.close();
    }
  }

  res.status(200).json(new ApiResponse(200, {
    voteSummary: summary,
    earlyEndApproved: approved,
  }, 'Vote recorded'));
});

// ── GET /:classroomId/students — Teacher views enrolled students ───────────────
export const getEnrolledStudents = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const result = await Enrollment.paginate(
    { classroomId, status: 'active' },
    {
      page: Number(page), limit: Math.min(Number(limit), 50),
      populate: { path: 'studentId', select: 'name phone avatarUrl isMinor' },
      select: 'studentId classesAttended feesPaidPaise createdAt earlyEndVote',
    },
  );

  res.status(200).json(new ApiResponse(200, result, 'Enrolled students'));
});