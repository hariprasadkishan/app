/**
 * student.middleware.js
 *
 * Student-specific authorization guard.
 * Ensures the authenticated user has the 'student' role.
 *
 * NOTE: authenticate middleware MUST run before this middleware.
 */

import ApiError from '../utils/ApiError.js';

export const requireStudent = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  if (req.user.role !== 'student') {
    throw new ApiError(403, 'Student access required', [], 'STUDENT_REQUIRED');
  }

  next();
};