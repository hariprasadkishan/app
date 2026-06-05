
import { TeacherProfile } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { VERIFICATION_STATUS } from '../constants/enums.js';

export const requireTeacher = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.role !== 'teacher') {
    throw new ApiError(403, 'Teacher access required', [], 'TEACHER_REQUIRED');
  }

  // Use correct field name: userId (not user)
  const profile = await TeacherProfile.findOne({ userId: req.user._id })
    .select('verificationStatus isAvailable')
    .lean();

  if (!profile) {
    throw new ApiError(
      403,
      'Teacher profile not found. Complete your KYC to continue.',
      [],
      'TEACHER_PROFILE_MISSING',
    );
  }

  // Use correct field name: verificationStatus (not status)
  if (profile.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    throw new ApiError(
      403,
      `Teacher profile is ${profile.verificationStatus}. Approval required to perform this action.`,
      [],
      'TEACHER_NOT_APPROVED',
    );
  }

  req.teacherProfile = profile;
  next();
});

/**
 * requireTeacherPending — teacher can access onboarding routes before approval
 * (e.g. KYC submission, document upload). Only blocks banned users.
 */
export const requireTeacherPending = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.role !== 'teacher') {
    throw new ApiError(403, 'Teacher access required', [], 'TEACHER_REQUIRED');
  }

  if (req.user.isBanned) {
    throw new ApiError(403, 'Account suspended', [], 'ACCOUNT_BANNED');
  }

  next();
});

export const requireTeacherOrAdmin = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.role === 'admin' || req.user.role === 'teacher') {
    return next();
  }

  throw new ApiError(403, 'Teacher or admin access required', [], 'INSUFFICIENT_ROLE');
};

/**
 * Factory: ensures the teacher owns a resource identified by a request param.
 * Admins bypass ownership checks.
 */
export const requireTeacherOwner = (paramKey = 'teacherId') => (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.role === 'admin') return next();

  const paramId = req.params[paramKey];
  if (req.user._id.toString() !== paramId) {
    throw new ApiError(403, 'Resource ownership required', [], 'OWNERSHIP_REQUIRED');
  }

  next();
};