/**
 * admin.middleware.js
 *
 * Admin authorization layer.
 *
 * TWO-FACTOR ADMIN CHECK:
 *   1. Role check   → req.user.role must be "admin"
 *   2. Allowlist    → user._id must be in ADMIN_IDS env var
 *
 * WHY BOTH: A single compromised account or a role-elevation DB attack
 * won't grant admin access without also being in the environment-level
 * allowlist.  This is a defence-in-depth pattern used in financial SaaS.
 *
 * NOTE: authenticate middleware MUST run before this middleware.
 */

import ApiError from "../utils/ApiError.js";
import env from "../config/env.config.js";

const ADMIN_ID_SET = new Set(env.ADMIN_IDS);

export const requireAdmin = (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  const isRoleAdmin = req.user.role === "admin";
  const isAllowlisted = ADMIN_ID_SET.has(req.user._id.toString());

  if (!isRoleAdmin || !isAllowlisted) {
    throw new ApiError(
      403,
      "Insufficient privileges",
      [],
      "ADMIN_REQUIRED"
    );
  }

  next();
};

/**
 * requireAdminOrSelf — for endpoints where a user may access their own
 * data but an admin can access anyone's (e.g. GET /users/:id/profile).
 */
export const requireAdminOrSelf = (paramKey = "userId") => (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  const targetId = req.params[paramKey];
  const isSelf = req.user._id.toString() === targetId;
  const isAdmin =
    req.user.role === "admin" && ADMIN_ID_SET.has(req.user._id.toString());

  if (!isSelf && !isAdmin) {
    throw new ApiError(403, "Access denied", [], "FORBIDDEN");
  }

  next();
};