// src/controllers/assignment.controller.js
import mongoose from 'mongoose';
import { Assignment, Enrollment, Classroom } from '../models/index.js';
import { CloudinaryService }  from '../services/cloudinary.service.js';
import { NotificationService } from '../services/notification.service.js';
import { asyncHandler }       from '../utils/AsyncHandler.js';
import ApiError               from '../utils/ApiError.js';
import ApiResponse            from '../utils/ApiResponse.js';
import { ASSIGNMENT_STATUS, SUBMISSION_STATUS, ENROLLMENT_STATUS } from '../constants/enums.js';
import logger                 from '../config/logger.config.js';

// ── POST /classrooms/:classroomId/assignments ─────────────────────────────────
export const createAssignment = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  const { title, instructions = '', dueDate, maxGrade = 100, attachmentUrls = [] } = req.body;

  if (!title?.trim()) throw ApiError.badRequest('title is required');
  if (!dueDate)        throw ApiError.badRequest('dueDate is required');
  if (new Date(dueDate) <= new Date()) throw ApiError.badRequest('dueDate must be in the future');

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');
  if (classroom.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('Only the classroom teacher can create assignments');
  }

  const assignment = await Assignment.create({
    classroomId,
    teacherId:    req.user._id,
    title:        title.trim(),
    instructions: instructions.trim(),
    dueDate:      new Date(dueDate),
    maxGrade:     Number(maxGrade),
    attachmentUrls,
    status:       ASSIGNMENT_STATUS.PUBLISHED,
  });

  // Non-blocking student notification
  const { User } = await import('../models/index.js');
  Enrollment.find({ classroomId, status: ENROLLMENT_STATUS.ACTIVE })
    .select('studentId').lean()
    .then(async (enrollments) => {
      const students = await User.find({ _id: { $in: enrollments.map((e) => e.studentId) } }).select('phone').lean();
      NotificationService.notifyNewAssignment(students, { title: classroom.title }, title.trim(), dueDate).catch(() => {});
    });

  logger.info('Assignment created', { classroomId, assignmentId: assignment._id });
  res.status(201).json(new ApiResponse(201, assignment, 'Assignment created'));
});

// ── GET /classrooms/:classroomId/assignments ──────────────────────────────────
export const getAssignments = asyncHandler(async (req, res) => {
  const { classroomId }   = req.params;
  const { page = 1, limit = 20 } = req.query;

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');

  const isTeacher = req.user?.role === 'teacher' && classroom.teacherId.toString() === req.user._id.toString();

  if (!isTeacher) {
    const enrolled = await Enrollment.findOne({ studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE }).lean();
    if (!enrolled) throw ApiError.forbidden('You must be enrolled to view assignments');
  }

  const filter = { classroomId, status: ASSIGNMENT_STATUS.PUBLISHED };

  const result = await Assignment.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 50),
    sort: { dueDate: 1 },
    // Teachers see all submissions; students see only their own sub
    ...(isTeacher ? {} : { select: '-submissions' }),
  });

  res.status(200).json(new ApiResponse(200, result, 'Assignments'));
});

// ── GET /classrooms/:classroomId/assignments/:assignmentId ────────────────────
export const getAssignmentDetail = asyncHandler(async (req, res) => {
  const { classroomId, assignmentId } = req.params;

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');

  const isTeacher = req.user?.role === 'teacher' && classroom.teacherId.toString() === req.user._id.toString();

  if (!isTeacher) {
    const enrolled = await Enrollment.findOne({ studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE }).lean();
    if (!enrolled) throw ApiError.forbidden('Not enrolled');
  }

  const assignment = await Assignment.findOne({ _id: assignmentId, classroomId }).lean();
  if (!assignment) throw ApiError.notFound('Assignment');

  // Students see only their own submission
  if (!isTeacher) {
    const mySubmission = assignment.submissions?.find(
      (s) => s.studentId.toString() === req.user._id.toString()
    ) || null;
    return res.status(200).json(new ApiResponse(200, { ...assignment, submissions: mySubmission ? [mySubmission] : [] }, 'Assignment detail'));
  }

  res.status(200).json(new ApiResponse(200, assignment, 'Assignment detail'));
});

// ── POST /classrooms/:classroomId/assignments/:assignmentId/submit ─────────────
export const submitAssignment = asyncHandler(async (req, res) => {
  const { classroomId, assignmentId } = req.params;
  const { textAnswer = '' } = req.body;

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');

  const enrolled = await Enrollment.findOne({ studentId: req.user._id, classroomId, status: ENROLLMENT_STATUS.ACTIVE }).lean();
  if (!enrolled) throw ApiError.forbidden('You must be enrolled to submit assignments');

  const assignment = await Assignment.findOne({ _id: assignmentId, classroomId, status: ASSIGNMENT_STATUS.PUBLISHED });
  if (!assignment) throw ApiError.notFound('Assignment');

  if (new Date(assignment.dueDate) < new Date()) {
    throw ApiError.badRequest('Assignment deadline has passed');
  }

  // Check for existing submission
  const existingSub = assignment.submissions?.find(
    (s) => s.studentId.toString() === req.user._id.toString()
  );
  if (existingSub && existingSub.status === SUBMISSION_STATUS.SUBMITTED) {
    throw new ApiError(409, 'You have already submitted this assignment', [], 'ALREADY_SUBMITTED');
  }

  let fileUrls = [];
  if (req.files && req.files.length > 0) {
    const results = await Promise.all(
      req.files.map((f) => CloudinaryService.uploadSubmission(f.buffer, assignmentId, req.user._id))
    );
    fileUrls = results.map((r) => r.secure_url);
  }

  const subData = {
    studentId:   req.user._id,
    status:      SUBMISSION_STATUS.SUBMITTED,
    submittedAt: new Date(),
    fileUrls,
    textAnswer:  textAnswer.trim(),
  };

  if (existingSub) {
    // Update existing (resubmission)
    await Assignment.findOneAndUpdate(
      { _id: assignmentId, 'submissions.studentId': req.user._id },
      { $set: { 'submissions.$': subData } },
    );
  } else {
    await Assignment.findByIdAndUpdate(assignmentId, { $push: { submissions: subData } });
  }

  res.status(200).json(new ApiResponse(200, subData, 'Assignment submitted'));
});

// ── PATCH /classrooms/:classroomId/assignments/:assignmentId/grade ─────────────
export const gradeSubmission = asyncHandler(async (req, res) => {
  const { classroomId, assignmentId } = req.params;
  const { studentId, grade, feedback = '' } = req.body;

  if (grade === undefined || grade === null) throw ApiError.badRequest('grade is required');

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');
  if (classroom.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('Only the classroom teacher can grade submissions');
  }

  const assignment = await Assignment.findOne({ _id: assignmentId, classroomId });
  if (!assignment) throw ApiError.notFound('Assignment');
  if (Number(grade) > assignment.maxGrade) {
    throw ApiError.badRequest(`Grade cannot exceed maxGrade of ${assignment.maxGrade}`);
  }

  await Assignment.findOneAndUpdate(
    { _id: assignmentId, 'submissions.studentId': new mongoose.Types.ObjectId(studentId) },
    {
      $set: {
        'submissions.$.grade':    Number(grade),
        'submissions.$.feedback': feedback.trim(),
        'submissions.$.gradedAt': new Date(),
        'submissions.$.gradedBy': req.user._id,
        'submissions.$.status':   SUBMISSION_STATUS.GRADED,
      },
    },
    { new: true },
  );

  res.status(200).json(new ApiResponse(200, null, 'Submission graded'));
});

// ── PATCH /classrooms/:classroomId/assignments/:assignmentId ──────────────────
export const updateAssignment = asyncHandler(async (req, res) => {
  const { classroomId, assignmentId } = req.params;
  const { title, instructions, dueDate, status } = req.body;

  const classroom = await Classroom.findById(classroomId).lean();
  if (!classroom) throw ApiError.notFound('Classroom');
  if (classroom.teacherId.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('Only the classroom teacher can update assignments');
  }

  const updates = {};
  if (title)        updates.title        = title.trim();
  if (instructions) updates.instructions = instructions.trim();
  if (dueDate)      updates.dueDate      = new Date(dueDate);
  if (status && Object.values(ASSIGNMENT_STATUS).includes(status)) updates.status = status;

  const assignment = await Assignment.findOneAndUpdate(
    { _id: assignmentId, classroomId },
    { $set: updates },
    { new: true, runValidators: true },
  );
  if (!assignment) throw ApiError.notFound('Assignment');

  res.status(200).json(new ApiResponse(200, assignment, 'Assignment updated'));
});