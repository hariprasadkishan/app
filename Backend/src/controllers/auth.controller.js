// src/controllers/auth.controller.js
import { User } from "../models/index.js";
import { OtpService } from "../services/otp.service.js";
import { TokenService } from "../services/token.service.js";
import { setAuthCookies, clearAuthCookies } from "../utils/cookie.util.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import logger from "../config/logger.config.js";

// ── POST /api/v1/auth/send-otp ────────────────────────────────────────────────
export const sendOtp = asyncHandler(async (req, res) => {
  const { phone, purpose } = req.body;
  const ipAddress = req.ip || req.socket?.remoteAddress;

  const result = await OtpService.generateAndSend(phone, purpose, ipAddress);

  res.status(200).json(
    new ApiResponse(200, { maskedPhone: result.maskedPhone, expiresAt: result.expiresAt }, "OTP sent successfully")
  );
});

// ── POST /api/v1/auth/verify-otp ──────────────────────────────────────────────
// Verifies OTP. Returns a one-time sessionToken.
// Frontend must immediately exchange this for a full token via /register or /login.
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp, purpose } = req.body;

  const { sessionToken } = await OtpService.verify(phone, otp, purpose);

  // Check if user already exists
  const existingUser = await User.findByPhone(phone);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        sessionToken,
        isNewUser: !existingUser,
        role: existingUser?.role ?? null,
      },
      "OTP verified successfully"
    )
  );
});

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const { sessionToken, name, email, role, city } = req.body;

  // Consume the one-time session token
  const { phone } = await OtpService.consumeSessionToken(sessionToken);

  // Prevent duplicate registration
  const existing = await User.findByPhone(phone);
  if (existing) {
    // User exists — log them in instead
    return _issueTokensAndRespond(res, existing, "Login successful");
  }

  // Email uniqueness check
  if (email) {
    const emailTaken = await User.findOne({ email: email.toLowerCase().trim() });
    if (emailTaken) {
      throw new ApiError(409, "Email already in use", [{ field: "email", message: "Already registered" }], "EMAIL_TAKEN");
    }
  }

  const user = await User.create({
    phone,
    name: name.trim(),
    email: email?.toLowerCase().trim() || undefined,
    role,
    city: city?.trim() || undefined,
    isPhoneVerified: true,
    onboardedAt: new Date(),
  });

  logger.info("New user registered", { userId: user._id, role, correlationId: req.correlationId });

  await _issueTokensAndRespond(res, user, "Registration successful");
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
// Exchange a verified sessionToken for access + refresh tokens (returning users)
export const login = asyncHandler(async (req, res) => {
  const { sessionToken } = req.body;

  const { phone } = await OtpService.consumeSessionToken(sessionToken);

  const user = await User.findByPhone(phone);
  if (!user) {
    throw new ApiError(404, "Account not found. Please register first.", [], "USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Your account has been deactivated.", [], "ACCOUNT_DEACTIVATED");
  }
  if (user.isBanned) {
    throw new ApiError(403, "Your account has been suspended.", [], "ACCOUNT_BANNED");
  }

  // Update last active
  await User.updateOne({ _id: user._id }, { lastActiveAt: new Date() });

  logger.info("User logged in", { userId: user._id, role: user.role, correlationId: req.correlationId });

  await _issueTokensAndRespond(res, user, "Login successful");
});

// ── POST /api/v1/auth/refresh ─────────────────────────────────────────────────
export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (!token) {
    throw new ApiError(401, "Refresh token required", [], "REFRESH_TOKEN_MISSING");
  }

  let decoded;
  try {
    decoded = TokenService.verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw new ApiError(401, "Invalid or expired refresh token", [], "REFRESH_TOKEN_INVALID");
  }

  const user = await User.findById(decoded._id)
    .select("_id role isActive isBanned name email phone")
    .lean();

  if (!user || !user.isActive || user.isBanned) {
    clearAuthCookies(res);
    throw new ApiError(401, "Session invalidated", [], "SESSION_INVALID");
  }

  // Rotate: issue new pair
  const accessToken = TokenService.generateAccessToken({ _id: user._id, role: user.role });
  const newRefreshToken = TokenService.generateRefreshToken({ _id: user._id, role: user.role });

  setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });

  res.status(200).json(
    new ApiResponse(200, { accessToken, user: _safeUser(user) }, "Token refreshed")
  );
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-fcmTokens -walletBalance")
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { user }, "User profile fetched"));
});

// ── PUT /api/v1/auth/me ───────────────────────────────────────────────────────
export const updateMe = asyncHandler(async (req, res) => {
  const ALLOWED = ["name", "email", "city"];
  const updates = {};

  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  if (updates.email) {
    const existing = await User.findOne({ email: updates.email.toLowerCase(), _id: { $ne: req.user._id } });
    if (existing) {
      throw new ApiError(409, "Email already in use", [{ field: "email", message: "Already registered" }], "EMAIL_TAKEN");
    }
    updates.email = updates.email.toLowerCase();
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select("-fcmTokens -walletBalance").lean();

  res.status(200).json(new ApiResponse(200, { user }, "Profile updated"));
});

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _issueTokensAndRespond(res, user, message) {
  const payload = { _id: user._id, role: user.role };
  const accessToken = TokenService.generateAccessToken(payload);
  const refreshToken = TokenService.generateRefreshToken(payload);

  setAuthCookies(res, { accessToken, refreshToken });

  res.status(200).json(
    new ApiResponse(200, { accessToken, user: _safeUser(user) }, message)
  );
}

function _safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    city: user.city,
    avatarUrl: user.avatarUrl,
    kycStatus: user.kycStatus,
    isPhoneVerified: user.isPhoneVerified,
  };
}