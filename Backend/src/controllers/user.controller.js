// src/controllers/user.controller.js
import { User, TeacherProfile, Enrollment, Classroom } from '../models/index.js';
import { OtpService }        from '../services/otp.service.js';
import { CloudinaryService } from '../services/cloudinary.service.js';
import { asyncHandler }      from '../utils/AsyncHandler.js';
import ApiError              from '../utils/ApiError.js';
import ApiResponse           from '../utils/ApiResponse.js';
import { OTP_PURPOSE }       from '../constants/enums.js';
import { AGE_LIMITS }        from '../constants/app.constants.js';
import logger                from '../config/logger.config.js';

const calcAge = (dob) =>
  (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);

// ── GET /me ───────────────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-fcmTokens -passwordHash -mfaSecret -parentGuardian.consentTokenHash')
    .lean({ virtuals: true });

  if (!user) throw ApiError.notFound('User');

  let profile = null;
  if (user.role === 'teacher') {
    profile = await TeacherProfile.findOne({ userId: user._id })
      .select('-adminNotes -searchKeywords')
      .lean({ virtuals: true });
  }

  res.status(200).json(new ApiResponse(200, { user, teacherProfile: profile }, 'Profile fetched'));
});

// ── PATCH /me ─────────────────────────────────────────────────────────────────
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'dateOfBirth', 'city', 'state', 'fcmTokens'];
  const updates = {};

  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.dateOfBirth) {
    const age = calcAge(updates.dateOfBirth);
    updates.isMinor = age < AGE_LIMITS.MINOR_THRESHOLD;
    // Child-safety: if newly minor, revoke parental consent flag → force re-verify
    if (updates.isMinor) {
      updates.parentalConsentVerified = false;
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true },
  ).select('-fcmTokens -passwordHash -mfaSecret');

  res.status(200).json(new ApiResponse(200, user, 'Profile updated'));
});

// ── POST /me/avatar ───────────────────────────────────────────────────────────
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  const result   = await CloudinaryService.uploadProfileImage(req.file.buffer, req.user._id);
  const avatarUrl = result.secure_url;

  await User.findByIdAndUpdate(req.user._id, { avatarUrl });
  logger.info('Avatar updated', { userId: req.user._id });
  res.status(200).json(new ApiResponse(200, { avatarUrl }, 'Avatar updated'));
});

// ── POST /me/parental-consent ─────────────────────────────────────────────────
export const submitParentalConsent = asyncHandler(async (req, res) => {
  if (!req.user.isMinor) {
    throw ApiError.badRequest('Parental consent is only required for minor accounts');
  }

  const { guardianName, guardianPhone, relation, otpFromGuardian } = req.body;
  if (!guardianName || !guardianPhone || !relation || !otpFromGuardian) {
    throw ApiError.badRequest('guardianName, guardianPhone, relation and otpFromGuardian are required');
  }

  await OtpService.verify(guardianPhone, otpFromGuardian, OTP_PURPOSE.PHONE_CHANGE);

  await User.findByIdAndUpdate(req.user._id, {
    'parentGuardian.name':        guardianName.trim(),
    'parentGuardian.phone':       guardianPhone.trim(),
    'parentGuardian.relation':    relation.trim(),
    'parentGuardian.consentedAt': new Date(),
    parentalConsentVerified:      true,
  });

  logger.warn('PARENTAL_CONSENT_GRANTED', { userId: req.user._id, guardianPhone });
  res.status(200).json(new ApiResponse(200, null, 'Parental consent verified'));
});

// ── POST /me/parental-consent/send-otp ───────────────────────────────────────
export const sendGuardianOtp = asyncHandler(async (req, res) => {
  const { guardianPhone } = req.body;
  if (!guardianPhone) throw ApiError.badRequest('guardianPhone is required');

  const result = await OtpService.generateAndSend(guardianPhone, OTP_PURPOSE.PHONE_CHANGE, req.ip);
  res.status(200).json(new ApiResponse(200, result, 'OTP sent to guardian'));
});

// ── DELETE /me ────────────────────────────────────────────────────────────────
export const deleteMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('User');

  await user.softDelete();

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  logger.warn('USER_SELF_DELETED', { userId: req.user._id });
  res.status(200).json(new ApiResponse(200, null, 'Account deleted'));
});

// ── FCM Token update ──────────────────────────────────────────────────────────
export const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) throw ApiError.badRequest('fcmToken is required');

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { fcmTokens: fcmToken },
  });
  res.status(200).json(new ApiResponse(200, null, 'FCM token registered'));
});

// ── Saved Classrooms ──────────────────────────────────────────────────────────
export const saveClassroom = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { savedClassrooms: classroomId },
  });
  res.status(200).json(new ApiResponse(200, null, 'Classroom saved'));
});

export const unsaveClassroom = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { savedClassrooms: classroomId },
  });
  res.status(200).json(new ApiResponse(200, null, 'Classroom removed from saved'));
});

export const getSavedClassrooms = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'savedClassrooms', select: 'title subject mode feesPaise stats status thumbnailUrl teacherId', populate: { path: 'teacherId', select: 'name avatarUrl' } })
    .lean();
  res.status(200).json(new ApiResponse(200, user.savedClassrooms || [], 'Saved classrooms'));
});

// ── Payment History ───────────────────────────────────────────────────────────
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const { Payment } = await import('../models/index.js');
  const { page = 1, limit = 20 } = req.query;

  const result = await Payment.paginate(
    { payerId: req.user._id },
    { page: Number(page), limit: Math.min(Number(limit), 50), sort: { createdAt: -1 }, select: '-razorpaySignature -idempotencyKey' },
  );
  res.status(200).json(new ApiResponse(200, result, 'Payment history'));
});

// ── Change Password ───────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) throw ApiError.badRequest('oldPassword and newPassword are required');
  if (newPassword.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');

  const user = await User.findById(req.user._id).select('+passwordHash');
  const valid = await user.comparePassword(oldPassword);
  if (!valid) throw ApiError.unauthorized('Old password is incorrect');

  user.passwordHash = newPassword; // pre-save hook hashes it
  await user.save();

  res.status(200).json(new ApiResponse(200, null, 'Password changed successfully'));
});