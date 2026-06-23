// src/routes/classroom.routes.js
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { requireTeacher } from '../middlewares/teacher.middleware.js';
import { requireStudent } from '../middlewares/student.middleware.js';
import { checkOwnership } from '../middlewares/ownership.middleware.js';
import { requireParentalConsentIfMinor } from '../middlewares/minorConsent.middleware.js';
import { handleClassroomMediaUpload } from '../middlewares/upload.middleware.js';
import { searchLimiter, uploadLimiter } from '../middlewares/rateLimit.middleware.js';
import { Classroom } from '../models/index.js';
import {
  createClassroom, updateClassroom, searchClassrooms,
  getClassroomDetail, requestEarlyEnd, uploadClassroomMedia,
  voteEarlyEnd, getEnrolledStudents,
} from '../controllers/classroom.controller.js';

const router = Router();

// ── Public search ─────────────────────────────────────────────────────────────
router.get('/search', searchLimiter, searchClassrooms);

// ── Detail (optional auth to show enrollment status + hide meet link) ─────────
router.get('/:classroomId', optionalAuthenticate, getClassroomDetail);

// ── Teacher creates classroom ─────────────────────────────────────────────────
router.post('/', authenticate, requireTeacher, createClassroom);

// ── Teacher updates classroom ─────────────────────────────────────────────────
router.patch(
  '/:classroomId',
  authenticate, requireTeacher,
  checkOwnership({ model: Classroom, paramKey: 'classroomId', ownerField: 'teacherId', resourceName: 'Classroom' }),
  updateClassroom,
);

// ── Teacher requests early end ────────────────────────────────────────────────
router.post(
  '/:classroomId/early-end',
  authenticate, requireTeacher,
  checkOwnership({ model: Classroom, paramKey: 'classroomId', ownerField: 'teacherId', resourceName: 'Classroom' }),
  requestEarlyEnd,
);

// ── Teacher uploads offline media ─────────────────────────────────────────────
router.post(
  '/:classroomId/media',
  authenticate, requireTeacher, uploadLimiter,
  checkOwnership({ model: Classroom, paramKey: 'classroomId', ownerField: 'teacherId', resourceName: 'Classroom' }),
  ...handleClassroomMediaUpload,
  uploadClassroomMedia,
);

// ── Student votes on early end ────────────────────────────────────────────────
router.post(
  '/:classroomId/vote-early-end',
  authenticate, requireStudent, requireParentalConsentIfMinor,
  voteEarlyEnd,
);

// ── Teacher views enrolled students ──────────────────────────────────────────
router.get(
  '/:classroomId/students',
  authenticate, requireTeacher,
  checkOwnership({ model: Classroom, paramKey: 'classroomId', ownerField: 'teacherId', resourceName: 'Classroom' }),
  getEnrolledStudents,
);

export default router;