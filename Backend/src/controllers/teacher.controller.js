// src/controllers/teacher.controller.js
import mongoose from 'mongoose';
import {
  User, TeacherProfile, Document, Classroom, Doubt,
  EnrollmentQuery, ExtraClass, Review, Enrollment,
} from '../models/index.js';
import { CloudinaryService } from '../services/cloudinary.service.js';
import { asyncHandler }      from '../utils/AsyncHandler.js';
import ApiError              from '../utils/ApiError.js';
import ApiResponse           from '../utils/ApiResponse.js';
import { DOCUMENT_TYPE, DOCUMENT_STATUS, VERIFICATION_STATUS } from '../constants/enums.js';
import { CLOUDINARY_FOLDERS } from '../constants/app.constants.js';
import logger                from '../config/logger.config.js';

// ── POST /onboarding/profile ──────────────────────────────────────────────────
export const submitProfile = asyncHandler(async (req, res) => {
  const {
    bio, headline, subjects, languages, city, state, country,
    experienceYears, education, bankAccount, portfolioUrls,
  } = req.body;

  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    throw ApiError.badRequest('At least one subject is required');
  }

  // Validate IFSC format if bank account provided
  if (bankAccount?.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankAccount.ifsc)) {
    throw ApiError.badRequest('Invalid IFSC code format');
  }

  const profile = await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        bio:             bio?.trim()      || '',
        headline:        headline?.trim() || '',
        subjects:        subjects.map(s => s.trim()),
        languages:       languages        || ['Hindi', 'English'],
        city:            city?.toLowerCase().trim(),
        state:           state?.toLowerCase().trim(),
        country:         country          || 'india',
        experienceYears: experienceYears  || 0,
        education:       education        || [],
        bankAccount:     bankAccount      || undefined,
        portfolioUrls:   portfolioUrls    || [],
      },
    },
    { new: true, upsert: true, runValidators: true },
  ).select('-adminNotes -searchKeywords');

  res.status(200).json(new ApiResponse(200, profile, 'Teacher profile updated'));
});

// ── POST /onboarding/kyc ──────────────────────────────────────────────────────
export const uploadKYC = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('At least one document file is required');
  }

  const documentType = req.body.documentType || DOCUMENT_TYPE.AADHAAR;
  if (!Object.values(DOCUMENT_TYPE).includes(documentType)) {
    throw ApiError.badRequest('Invalid document type');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const docIds = [];

    for (let i = 0; i < req.files.length; i++) {
      const file   = req.files[i];
      const result = await CloudinaryService.uploadKYCDocument(
        file.buffer,
        req.user._id.toString(),
        `${documentType}_${i}`,
      );

      const [doc] = await Document.create([{
        teacherId:     req.user._id,
        type:          documentType,
        fileUrl:       result.secure_url,
        s3Key:         result.public_id,
        mimeType:      file.mimetype,
        fileSizeBytes: file.size,
        status:        DOCUMENT_STATUS.UPLOADED,
      }], { session });

      docIds.push(doc._id);
    }

    await TeacherProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $push: { kycDocumentIds: { $each: docIds } } },
      { session },
    );

    await User.findByIdAndUpdate(
      req.user._id,
      { kycStatus: 'under_review' },
      { session },
    );

    await session.commitTransaction();
    logger.info('KYC documents uploaded', { userId: req.user._id, count: docIds.length });
    res.status(200).json(new ApiResponse(200, { uploaded: docIds.length }, 'Documents uploaded. Under review.'));
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── GET /me/dashboard ─────────────────────────────────────────────────────────
export const getDashboard = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const [
    classroomStats,
    pendingQueries,
    pendingDoubts,
    pendingExtraClasses,
    upcomingSchedule,
  ] = await Promise.all([
    Classroom.aggregate([
      { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
      {
        $group: {
          _id:                null,
          total:              { $sum: 1 },
          active:             { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          completed:          { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          totalStudents:      { $sum: '$stats.enrolledStudents' },
          totalEarningsPaise: { $sum: '$stats.totalEarningsPaise' },
        },
      },
    ]),
    EnrollmentQuery.countDocuments({ teacherId, status: 'pending' }),
    Doubt.countDocuments({ teacherId, status: 'open' }),
    ExtraClass.countDocuments({ teacherId, status: 'pending' }),
    // Next 7 days of scheduled classrooms
    Classroom.find({
      teacherId,
      status: 'active',
      endDate: { $gte: new Date() },
    }).select('title subject schedule mode gmeetLink stats').limit(10).lean(),
  ]);

  const profile = await TeacherProfile.findOne({ userId: teacherId })
    .select('walletPaise stats verificationStatus bio headline subjects')
    .lean({ virtuals: true });

  res.status(200).json(new ApiResponse(200, {
    classroomStats: classroomStats[0] || { total: 0, active: 0, completed: 0, totalStudents: 0, totalEarningsPaise: 0 },
    pendingQueries,
    pendingDoubts,
    pendingExtraClasses,
    upcomingSchedule,
    walletPaise: profile?.walletPaise || 0,
    verificationStatus: profile?.verificationStatus,
  }, 'Dashboard data'));
});

// ── GET /me/earnings ──────────────────────────────────────────────────────────
export const getEarnings = asyncHandler(async (req, res) => {
  const { Payout } = await import('../models/index.js');

  const [profile, payouts] = await Promise.all([
    TeacherProfile.findOne({ userId: req.user._id })
      .select('walletPaise stats.totalEarningsPaise stats.withdrawnPaise stats.pendingPayoutPaise')
      .lean(),
    Payout.find({ teacherId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  res.status(200).json(new ApiResponse(200, {
    walletPaise:         profile?.walletPaise || 0,
    totalEarningsPaise:  profile?.stats?.totalEarningsPaise || 0,
    withdrawnPaise:      profile?.stats?.withdrawnPaise || 0,
    pendingPayoutPaise:  profile?.stats?.pendingPayoutPaise || 0,
    recentPayouts:       payouts,
  }, 'Earnings data'));
});

// ── GET /me/queries ───────────────────────────────────────────────────────────
export const getMyQueries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { teacherId: req.user._id };
  if (status) filter.status = status;

  const result = await EnrollmentQuery.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 50),
    sort: { createdAt: -1 },
    populate: [
      { path: 'studentId',   select: 'name phone avatarUrl' },
      { path: 'classroomId', select: 'title subject feesPaise' },
    ],
  });

  res.status(200).json(new ApiResponse(200, result, 'Queries fetched'));
});

// ── GET /:teacherId/public ────────────────────────────────────────────────────
export const getPublicProfile = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;

  const [user, profile, classrooms, ratingBreakdown] = await Promise.all([
    User.findOne({ _id: teacherId, role: 'teacher', isActive: true })
      .select('name avatarUrl city state createdAt')
      .lean(),
    TeacherProfile.findOne({ userId: teacherId, verificationStatus: VERIFICATION_STATUS.APPROVED })
      .select('-adminNotes -searchKeywords -bankAccount -aadhaarNumber -kycDocumentIds -razorpayContactId -razorpayFundId')
      .lean({ virtuals: true }),
    Classroom.find({ teacherId, status: 'active' })
      .select('title subject stream mode feesPaise maxStudents stats schedule startDate endDate')
      .limit(10).lean(),
    Review.ratingBreakdown(teacherId),
  ]);

  if (!user || !profile) throw ApiError.notFound('Teacher');

  res.status(200).json(new ApiResponse(200, {
    user, profile, classrooms, ratingBreakdown,
  }, 'Teacher public profile'));
});

// ── GET /me/classrooms ────────────────────────────────────────────────────────
export const getMyClassrooms = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { teacherId: req.user._id };
  if (status) filter.status = status;

  const result = await Classroom.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 30),
    sort: { createdAt: -1 },
  });

  res.status(200).json(new ApiResponse(200, result, 'My classrooms'));
});

// ── GET /me/doubts ────────────────────────────────────────────────────────────
export const getMyDoubts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status = 'open' } = req.query;

  const result = await Doubt.paginate(
    { teacherId: req.user._id, status },
    {
      page: Number(page), limit: Math.min(Number(limit), 50),
      sort: { createdAt: -1 },
      populate: [
        { path: 'studentId',   select: 'name avatarUrl' },
        { path: 'classroomId', select: 'title subject' },
      ],
    },
  );

  res.status(200).json(new ApiResponse(200, result, 'Doubts inbox'));
});

// ── PATCH /me/availability ────────────────────────────────────────────────────
export const updateAvailability = asyncHandler(async (req, res) => {
  const { isAvailableForNewClassrooms } = req.body;
  if (typeof isAvailableForNewClassrooms !== 'boolean') {
    throw ApiError.badRequest('isAvailableForNewClassrooms must be a boolean');
  }

  await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id },
    { isAvailableForNewClassrooms },
  );

  res.status(200).json(new ApiResponse(200, null, 'Availability updated'));
});