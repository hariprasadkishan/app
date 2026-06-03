/**
 * auth.middleware.js
 *
 * JWT-based authentication middleware.
 *
 * TOKEN STRATEGY:
 *   - Access token  → short-lived (15 min), sent in Authorization header
 *                     OR httpOnly cookie (client choice)
 *   - Refresh token → long-lived (7 days), httpOnly + secure + sameSite
 *                     cookie ONLY (never in localStorage)
 *
 * ROTATION: Every time a refresh token is used to issue a new access token,
 * the refresh token is also rotated (see token.service.js).  This limits
 * the damage window of a stolen refresh token.
 *
 * COOKIE PREFERENCE: We check the Authorization header first, then the
 * cookie.  This supports both browser and API clients.
 *
 * SECURITY NOTES:
 *   - We never reveal whether a token is expired vs invalid (prevents oracle).
 *   - Lean query used — we never hydrate the full document for auth checks.
 */

import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import env from "../config/env.config.js";

// ─── Token extraction helper ──────────────────────────────────────────────────

function extractToken(req) {
  // Prefer Authorization header (Bearer scheme) — works for API clients
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fall back to httpOnly cookie — works for browser clients
  return req.cookies?.accessToken ?? null;
}

// ─── Main auth middleware ─────────────────────────────────────────────────────

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);

  if (!token) {
    throw new ApiError(401, "Authentication required", [], "AUTH_REQUIRED");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  } catch (err) {
    // Uniform error — don't leak expiry vs invalid distinction
    throw new ApiError(401, "Invalid or expired token", [], "AUTH_INVALID");
  }

  // Lean query — only fetch what auth guards need
  const user = await User.findById(decoded._id)
    .select("_id role isActive isVerified isBanned")
    .lean();

  if (!user) {
    throw new ApiError(401, "User not found", [], "AUTH_USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account deactivated", [], "ACCOUNT_DEACTIVATED");
  }

  if (user.isBanned) {
    throw new ApiError(403, "Account suspended", [], "ACCOUNT_BANNED");
  }

  req.user = user;
  next();
});

// ─── Optional auth (for public routes that enhance response if logged in) ─────

export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id)
      .select("_id role isActive isBanned")
      .lean();

    if (user?.isActive && !user.isBanned) {
      req.user = user;
    }
  } catch {
    // Silently ignore — optional auth never blocks the request
  }

  next();
});