/**
 * teacher.middleware.js
 *
 * Teacher-specific authorization guards.
 *
 * GUARDS:
 *   requireTeacher        → user must have teacher role + approved profile
 *   requireTeacherOrAdmin → teacher or admin can proceed
 *   requireTeacherOwner   → teacher must own the resource being accessed
 *
 * We validate against the TeacherProfile model rather than just the role
 * flag because a teacher may have role="teacher" but a suspended/pending
 * profile — they should not be able to perform teacher actions in that state.
 */

import { TeacherProfile } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireTeacher = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  if (req.user.role !== "teacher") {
    throw new ApiError(403, "Teacher access required", [], "TEACHER_REQUIRED");
  }

  // Fetch minimal profile to check approval status
  const profile = await TeacherProfile.findOne({ user: req.user._id })
    .select("status isProfileComplete")
    .lean();

  if (!profile) {
    throw new ApiError(403, "Teacher profile not found. Complete onboarding.", [], "TEACHER_PROFILE_MISSING");
  }

  if (profile.status !== "approved") {
    throw new ApiError(
      403,
      `Teacher profile is ${profile.status}. Access requires approved status.`,
      [],
      "TEACHER_NOT_APPROVED"
    );
  }

  // Attach profile stub so downstream services don't need to re-query
  req.teacherProfile = profile;
  next();
});

export const requireTeacherOrAdmin = asyncHandler(async (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  if (req.user.role === "admin") return next();
  if (req.user.role === "teacher") return next();

  throw new ApiError(403, "Teacher or admin access required", [], "INSUFFICIENT_ROLE");
});

/**
 * Factory: ensures the teacher owns a resource identified by a request param.
 * Usage: requireTeacherOwner("teacherId")
 */
export const requireTeacherOwner = (paramKey = "teacherId") => (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  if (req.user.role === "admin") return next(); // Admins bypass ownership

  const paramId = req.params[paramKey];
  if (req.user._id.toString() !== paramId) {
    throw new ApiError(403, "Resource ownership required", [], "OWNERSHIP_REQUIRED");
  }

  next();
};