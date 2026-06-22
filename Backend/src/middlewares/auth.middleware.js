
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import env from '../config/env.config.js';

// ─── Token extraction helper ──────────────────────────────────────────────────

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies?.accessToken ?? null;
}

// ─── Main auth middleware ─────────────────────────────────────────────────────

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError(401, 'Authentication required', [], 'AUTH_REQUIRED');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired token', [], 'AUTH_INVALID');
  }

  const user = await User.findById(decoded._id)
    .select('_id role isActive isBanned isMinor parentalConsentVerified')
    .lean();

  if (!user) {
    throw new ApiError(401, 'User not found', [], 'AUTH_USER_NOT_FOUND');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account deactivated', [], 'ACCOUNT_DEACTIVATED');
  }

  
  if (user.isBanned) {
    throw new ApiError(403, 'Account suspended', [], 'ACCOUNT_BANNED');
  }

  req.user = user;
  next();
});

// ─── Optional auth ─────────────────────────────────────────────────────────

export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id)
      .select('_id role isActive isBanned isMinor parentalConsentVerified')
      .lean();

    if (user?.isActive && !user.isBanned) {
      req.user = user;
    }
  } catch {
    // Silently ignore — optional auth never blocks the request
  }

  next();
});