// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/auth.controller.js
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import { User, TeacherProfile, StudentWallet } from '../models/index.js';
import { OtpService }     from '../services/otp.service.js';
import { TokenService }   from '../services/token.service.js';
import { GoogleService }  from '../services/google.service.js';
import { WalletService }  from '../services/wallet.service.js';
import { NotificationService } from '../services/notification.service.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie.util.js';
import { asyncHandler }   from '../utils/AsyncHandler.js';
import ApiError           from '../utils/ApiError.js';
import ApiResponse        from '../utils/ApiResponse.js';
import { OTP_PURPOSE, ROLES } from '../constants/enums.js';
import { AGE_LIMITS }     from '../constants/app.constants.js';
import logger             from '../config/logger.config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  const ms = Date.now() - new Date(dob).getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
};

const issueTokens = (res, user) => {
  const tokens = TokenService.generateTokenPair(user);
  setAuthCookies(res, tokens);
  return tokens;
};

const safeProfile = (user) => {
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.passwordHash;
  delete u.mfaSecret;
  delete u.fcmTokens;
  return u;
};

// ── Signup ────────────────────────────────────────────────────────────────────

export const signupSendOtp = asyncHandler(async (req, res) => {
  const { phone, role } = req.body;

  if (!phone || !role)           throw ApiError.badRequest('phone and role are required');
  if (!Object.values(ROLES).includes(role)) throw ApiError.badRequest('Invalid role');
  if (role === ROLES.ADMIN)      throw ApiError.forbidden('Cannot register as admin');

  const existing = await User.findByPhone(phone);
  if (existing) throw new ApiError(400, 'Phone number already registered', [], 'PHONE_EXISTS');

  const result = await OtpService.generateAndSend(phone, OTP_PURPOSE.REGISTER, req.ip);
  res.status(200).json(new ApiResponse(200, result, 'OTP sent successfully'));
});

export const signupVerifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) throw ApiError.badRequest('phone and otp are required');

  const { sessionToken, phone: verifiedPhone } = await OtpService.verify(phone, otp, OTP_PURPOSE.REGISTER);
  res.status(200).json(new ApiResponse(200, { sessionToken, phone: verifiedPhone }, 'OTP verified'));
});

export const signupComplete = asyncHandler(async (req, res) => {
  const { sessionToken, name, role, dateOfBirth, password, email, ...teacherFields } = req.body;

  if (!sessionToken || !name || !role || !dateOfBirth || !password) {
    throw ApiError.badRequest('sessionToken, name, role, dateOfBirth and password are required');
  }

  const { phone } = await OtpService.consumeSessionToken(sessionToken);

  // Re-check no race-condition duplicate
  const existing = await User.findByPhone(phone);
  if (existing) throw new ApiError(409, 'Phone already registered', [], 'PHONE_EXISTS');

  const age     = calcAge(dateOfBirth);
  const isMinor = age < AGE_LIMITS.MINOR_THRESHOLD;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (role === ROLES.STUDENT) {
      const [user] = await User.create([{
        phone,
        name:            name.trim(),
        role:            ROLES.STUDENT,
        dateOfBirth:     new Date(dateOfBirth),
        isMinor,
        email:           email?.toLowerCase()?.trim() || undefined,
        passwordHash:    password,       // pre-save hook hashes it
        isPhoneVerified: true,
        isActive:        true,
      }], { session });

      await StudentWallet.create([{ studentId: user._id, tokenBalance: 0, cashBalancePaise: 0 }], { session });
      await session.commitTransaction();

      const tokens = issueTokens(res, user);
      logger.info('Student registered', { userId: user._id });
      return res.status(201).json(new ApiResponse(201, {
        user: safeProfile(user),
        accessToken: tokens.accessToken,
      }, 'Registration successful'));
    }

    if (role === ROLES.TEACHER) {
      if (age < AGE_LIMITS.MIN_TEACHER_AGE) {
        throw new ApiError(403, 'Teachers must be at least 18 years old', [], 'AGE_RESTRICTION');
      }

      const [user] = await User.create([{
        phone,
        name:                  name.trim(),
        role:                  ROLES.TEACHER,
        dateOfBirth:           new Date(dateOfBirth),
        isMinor:               false,
        email:                 email?.toLowerCase()?.trim() || undefined,
        passwordHash:          password,
        isPhoneVerified:       true,
        isActive:              true,
        isVerificationPending: true,
        kycStatus:             'pending',
      }], { session });

      await TeacherProfile.create([{
        userId:             user._id,
        verificationStatus: 'pending',
        subjects:           teacherFields.subjects || ['Other'],
        bio:                teacherFields.bio       || '',
        city:               teacherFields.city      || '',
        state:              teacherFields.state     || '',
      }], { session });

      await session.commitTransaction();
      logger.info('Teacher registered (pending KYC)', { userId: user._id });
      return res.status(201).json(new ApiResponse(201, {
        registrationComplete: true,
        message:              'Account created. Please complete KYC verification.',
        userId:               user._id,
      }, 'Teacher account created'));
    }

    throw ApiError.badRequest('Invalid role');

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginSendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) throw ApiError.badRequest('phone is required');

  const user = await User.findByPhone(phone);
  if (!user)        throw ApiError.notFound('No account found with this phone number');
  if (user.isBanned) throw ApiError.forbidden('Account suspended. Contact support.');
  if (!user.isActive) throw ApiError.forbidden('Account deactivated');

  const result = await OtpService.generateAndSend(phone, OTP_PURPOSE.LOGIN, req.ip);
  res.status(200).json(new ApiResponse(200, result, 'OTP sent'));
});

export const loginVerifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) throw ApiError.badRequest('phone and otp are required');

  const { phone: verifiedPhone } = await OtpService.verify(phone, otp, OTP_PURPOSE.LOGIN);
  const user = await User.findByPhone(verifiedPhone);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or deactivated');

  const tokens = issueTokens(res, user);
  await user.touchActivity();

  res.status(200).json(new ApiResponse(200, {
    user: safeProfile(user),
    accessToken: tokens.accessToken,
  }, 'Login successful'));
});

export const loginWithPassword = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) throw ApiError.badRequest('phone and password are required');

  const user = await User.findOne({ phone: phone.trim(), deletedAt: null }).select('+passwordHash');
  // Generic message — never disclose which field failed
  if (!user) throw ApiError.unauthorized('Invalid credentials');
  if (user.isBanned) throw ApiError.forbidden('Account suspended');

  const valid = await user.comparePassword(password);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  // Teacher pending KYC: allow login but limit access (client reads the flag)
  const kycPending = user.role === ROLES.TEACHER && user.isVerificationPending;

  const tokens = issueTokens(res, user);
  await user.touchActivity();

  res.status(200).json(new ApiResponse(200, {
    user:         safeProfile(user),
    accessToken:  tokens.accessToken,
    kycPending,
  }, 'Login successful'));
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

export const googleAuthUrl = asyncHandler(async (req, res) => {
  const { state = '' } = req.query;
  const url = GoogleService.buildAuthUrl(state);
  res.redirect(url);
});

export const googleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw ApiError.badRequest('Missing Google auth code');

  const { profile } = await GoogleService.getProfileFromCode(code);

  // Find by googleId OR email
  let user = await User.findOne({
    $or: [{ googleId: profile.sub }, { email: profile.email }],
    deletedAt: null,
  });

  if (!user) {
    // New user → redirect frontend to complete-profile page
    const encodedProfile = Buffer.from(JSON.stringify({
      googleId: profile.sub,
      email:    profile.email,
      name:     profile.name,
      avatar:   profile.picture,
    })).toString('base64');
    return res.redirect(`${process.env.FRONTEND_URL}/auth/complete-profile?g=${encodedProfile}&state=${state}`);
  }

  if (user.isBanned)   throw ApiError.forbidden('Account suspended');
  if (!user.googleId) {
    user.googleId  = profile.sub;
    user.avatarUrl = user.avatarUrl || profile.picture;
    await user.save();
  }

  const tokens = issueTokens(res, user);
  await user.touchActivity();
  res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${tokens.accessToken}`);
});

export const googleComplete = asyncHandler(async (req, res) => {
  const { googleData, role, password, dateOfBirth, name } = req.body;
  if (!googleData || !role || !password || !dateOfBirth) {
    throw ApiError.badRequest('googleData, role, password and dateOfBirth are required');
  }

  let profile;
  try {
    profile = JSON.parse(Buffer.from(googleData, 'base64').toString('utf8'));
  } catch {
    throw ApiError.badRequest('Invalid googleData');
  }

  const existing = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });
  if (existing) throw new ApiError(409, 'Account already exists. Please login.', [], 'ACCOUNT_EXISTS');

  const age     = calcAge(dateOfBirth);
  const isMinor = age < AGE_LIMITS.MINOR_THRESHOLD;

  if (role === ROLES.TEACHER && age < AGE_LIMITS.MIN_TEACHER_AGE) {
    throw new ApiError(403, 'Teachers must be at least 18 years old', [], 'AGE_RESTRICTION');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userData = {
      name:            (name || profile.name).trim(),
      email:           profile.email,
      googleId:        profile.googleId,
      avatarUrl:       profile.avatar,
      role,
      dateOfBirth:     new Date(dateOfBirth),
      isMinor,
      passwordHash:    password,
      isPhoneVerified: false,
      isActive:        true,
      phone:           `google_${profile.googleId}`, // placeholder until phone is added
    };

    if (role === ROLES.TEACHER) {
      userData.isVerificationPending = true;
      userData.kycStatus = 'pending';
    }

    const [user] = await User.create([userData], { session });

    if (role === ROLES.STUDENT) {
      await StudentWallet.create([{ studentId: user._id }], { session });
      await session.commitTransaction();
      const tokens = issueTokens(res, user);
      return res.status(201).json(new ApiResponse(201, {
        user: safeProfile(user), accessToken: tokens.accessToken,
      }, 'Account created'));
    }

    await TeacherProfile.create([{
      userId: user._id, verificationStatus: 'pending', subjects: ['Other'],
    }], { session });
    await session.commitTransaction();
    return res.status(201).json(new ApiResponse(201, {
      registrationComplete: true, userId: user._id,
    }, 'Teacher account created. Complete KYC.'));

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── Token Management ──────────────────────────────────────────────────────────

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw ApiError.unauthorized('Refresh token not found');

  const decoded = TokenService.verifyRefreshToken(token);
  const user    = await User.findById(decoded._id).select('_id role isActive isBanned').lean();

  if (!user || !user.isActive || user.isBanned) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('Session invalid. Please login again.');
  }

  const tokens = issueTokens(res, user);
  res.status(200).json(new ApiResponse(200, { accessToken: tokens.accessToken }, 'Token refreshed'));
});

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});