/**
 * ownership.middleware.js
 *
 * Generic factory for "does this user own this resource" checks — used on
 * routes like PATCH /classrooms/:classroomId, POST /classrooms/:classroomId/materials,
 * where a teacher must own the classroom (or be an admin) to mutate it.
 *
 * WHY GENERIC: We have many owned resources (Classroom.teacherId,
 * Enrollment.studentId, Doubt.studentId, ...). Repeating a one-off
 * ownership check in every controller is error-prone — a single forgotten
 * check is a broken-access-control vulnerability (OWASP API1:2023).
 * Centralising it here means the check is written once and tested once.
 *
 * USAGE:
 *   router.patch(
 *     "/:classroomId",
 *     authenticate, requireTeacher,
 *     checkOwnership({ model: Classroom, paramKey: "classroomId", ownerField: "teacherId" }),
 *     classroomController.update
 *   );
 *
 * The loaded document is attached to req.resource for the controller to
 * reuse (avoids a second DB round-trip).
 */

import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';

export const checkOwnership = ({
  model,
  paramKey,
  ownerField = 'userId',
  allowAdmin = true,
  resourceName = 'Resource',
  select = null,
}) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
    }

    const resourceId = req.params[paramKey];
    if (!mongoose.isValidObjectId(resourceId)) {
      throw new ApiError(400, `Invalid ${paramKey}`, [], 'INVALID_ID');
    }

    const query = model.findById(resourceId);
    if (select) query.select(select);
    const resource = await query.lean();

    if (!resource) {
      throw new ApiError(404, `${resourceName} not found`, [], 'RESOURCE_NOT_FOUND');
    }

    const isAdmin = allowAdmin && req.user.role === 'admin';
    const ownerValue = resource[ownerField];
    const isOwner = ownerValue && ownerValue.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, `You do not have access to this ${resourceName.toLowerCase()}`, [], 'OWNERSHIP_REQUIRED');
    }

    req.resource = resource;
    next();
  });
