// src/controllers/teacher.controller.js
import mongoose from "mongoose";
import { User, TeacherProfile, Document, Booking, Payout } from "../models/index.js";
import { CloudinaryService } from "../services/cloudinary.service.js";
import { NotificationService } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { validateObjectId } from "../utils/objectId.util.js";
import { paginate } from "../utils/pagination.util.js";
import { VERIFICATION_STATUS, DOCUMENT_TYPE, BOOKING_STATUS } from "../constants/enums.js";
import logger from "../config/logger.config.js";

// ── GET /api/v1/teachers ──────────────────────────────────────────────────────
// Public — search & paginate approved teachers
export const searchTeachers = asyncHandler(async (req, res) => {
  const {
    subjects, classGrades, city, minRate, maxRate,
    nearLng, nearLat, maxDistanceKm = 50,
    minRating = 0, textQuery,
    page = 1, limit = 20, sort = "rating",
  } = req.query;

  const result = await TeacherProfile.search({
    subjects: subjects ? (Array.isArray(subjects) ? subjects : [subjects]) : undefined,
    classGrades: classGrades ? (Array.isArray(classGrades) ? classGrades : [classGrades]) : undefined,
    city,
    minRate: minRate ? Number(minRate) : undefined,
    maxRate: maxRate ? Number(maxRate) : undefined,
    nearLng: nearLng ? Number(nearLng) : undefined,
    nearLat: nearLat ? Number(nearLat) : undefined,
    maxDistanceKm: Number(maxDistanceKm),
    minRating: Number(minRating),
    textQuery,
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort,
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Teachers fetched"));
});

// ── GET /api/v1/teachers/:teacherId ──────────────────────────────────────────
// Public — teacher profile page
export const getTeacherPublicProfile = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, "teacherId");

  const profile = await TeacherProfile.findOne({ userId: teacherId, verificationStatus: VERIFICATION_STATUS.APPROVED })
    .populate("userId", "name avatarUrl phone")
    .lean({ virtuals: true });

  if (!profile) {
    throw new ApiError(404, "Teacher not found or not verified", [], "TEACHER_NOT_FOUND");
  }

  // Never expose phone in public profile
  if (profile.userId?.phone) delete profile.userId.phone;

  res.status(200).json(new ApiResponse(200, { profile }, "Teacher profile fetched"));
});

// ── GET /api/v1/teachers/me/profile ──────────────────────────────────────────
// Authenticated teacher — their own full profile
export const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await TeacherProfile.findOne({ userId: req.user._id })
    .populate("userId", "name email phone avatarUrl kycStatus")
    .lean({ virtuals: true });

  if (!profile) {
    throw new ApiError(404, "Teacher profile not found. Please complete KYC.", [], "PROFILE_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { profile }, "Profile fetched"));
});

// ── POST /api/v1/teachers/kyc ─────────────────────────────────────────────────
// Teacher submits KYC (create or update profile)
export const submitKyc = asyncHandler(async (req, res) => {
  const { bio, headline, subjects, classGrades, boards, hourlyRatePaise,
    experienceYears, onlineOnly, city, state, languages } = req.body;

  const existingProfile = await TeacherProfile.findOne({ userId: req.user._id });

  if (existingProfile && existingProfile.verificationStatus === VERIFICATION_STATUS.APPROVED) {
    throw new ApiError(400, "Profile already approved. Use update endpoints.", [], "ALREADY_APPROVED");
  }

  const profileData = {
    userId: req.user._id,
    bio, headline,
    subjects: Array.isArray(subjects) ? subjects : [subjects],
    classGrades: classGrades ? (Array.isArray(classGrades) ? classGrades : [classGrades]) : [],
    boards: boards ? (Array.isArray(boards) ? boards : [boards]) : [],
    hourlyRatePaise: Number(hourlyRatePaise),
    experienceYears: Number(experienceYears) || 0,
    onlineOnly: Boolean(onlineOnly),
    city: city?.trim().toLowerCase(),
    state: state?.trim().toLowerCase(),
    languages: languages ? (Array.isArray(languages) ? languages : [languages]) : ["Hindi", "English"],
    verificationStatus: VERIFICATION_STATUS.PENDING,
  };

  let profile;
  if (existingProfile) {
    Object.assign(existingProfile, profileData);
    profile = await existingProfile.save();
  } else {
    profile = await TeacherProfile.create(profileData);
  }

  // Update user kycStatus
  await User.findByIdAndUpdate(req.user._id, { kycStatus: "pending" });

  logger.info("KYC submitted", { userId: req.user._id, correlationId: req.correlationId });

  res.status(200).json(new ApiResponse(200, { profileId: profile._id }, "KYC submitted for review"));
});

// ── PUT /api/v1/teachers/me/profile ──────────────────────────────────────────
// Approved teacher updates their profile
export const updateMyProfile = asyncHandler(async (req, res) => {
  const ALLOWED = ["bio", "headline", "subjects", "classGrades", "boards",
    "hourlyRatePaise", "experienceYears", "onlineOnly", "city", "state",
    "languages", "introVideoUrl", "portfolioUrls", "isAvailable"];

  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.hourlyRatePaise) updates.hourlyRatePaise = Number(updates.hourlyRatePaise);
  if (updates.city) updates.city = updates.city.trim().toLowerCase();

  const profile = await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: updates },
    { new: true, runValidators: true }
  ).lean({ virtuals: true });

  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", [], "PROFILE_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { profile }, "Profile updated"));
});

// ── POST /api/v1/teachers/me/avatar ──────────────────────────────────────────
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is required", [], "FILE_MISSING");
  }

  // Delete old avatar
  const user = await User.findById(req.user._id).select("avatarUrl").lean();
  if (user?.avatarUrl) {
    await CloudinaryService.delete(user.avatarUrl).catch(() => {});
  }

  const result = await CloudinaryService.uploadBuffer(req.file.buffer, {
    folder: "trueed/avatars",
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
  });

  await User.findByIdAndUpdate(req.user._id, { avatarUrl: result.secure_url });

  res.status(200).json(new ApiResponse(200, { avatarUrl: result.secure_url }, "Avatar uploaded"));
});

// ── POST /api/v1/teachers/me/documents ───────────────────────────────────────
export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Document file is required", [], "FILE_MISSING");
  }

  const { type } = req.body;
  if (!Object.values(DOCUMENT_TYPE).includes(type)) {
    throw new ApiError(400, `Invalid document type: ${type}`, [], "INVALID_DOC_TYPE");
  }

  const result = await CloudinaryService.uploadBuffer(req.file.buffer, {
    folder: "trueed/documents",
    resource_type: "auto",
  });

  const doc = await Document.create({
    teacherId: req.user._id,
    type,
    fileUrl: result.secure_url,
    mimeType: req.file.mimetype,
    fileSizeBytes: req.file.size,
    version: 1,
  });

  res.status(201).json(new ApiResponse(201, { documentId: doc._id, fileUrl: doc.fileUrl }, "Document uploaded"));
});

// ── GET /api/v1/teachers/me/documents ────────────────────────────────────────
export const getMyDocuments = asyncHandler(async (req, res) => {
  const docs = await Document.getActiveByTeacher(req.user._id);
  res.status(200).json(new ApiResponse(200, { documents: docs }, "Documents fetched"));
});

// ── POST /api/v1/teachers/me/availability ────────────────────────────────────
export const setAvailability = asyncHandler(async (req, res) => {
  const { slots, isAvailable } = req.body;

  const update = {};
  if (typeof isAvailable === "boolean") update.isAvailable = isAvailable;

  if (Array.isArray(slots)) {
    // Replace entire availability
    update.availableSlots = slots.map(s => ({
      day: Number(s.day),
      startTime: s.startTime,
      endTime: s.endTime,
      slotDuration: Number(s.slotDuration) || 60,
      isBooked: false,
      bookedBy: null,
    }));
  }

  const profile = await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: update },
    { new: true }
  ).select("availableSlots isAvailable").lean();

  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", [], "PROFILE_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { availableSlots: profile.availableSlots, isAvailable: profile.isAvailable }, "Availability updated"));
});

// ── GET /api/v1/teachers/me/dashboard ────────────────────────────────────────
export const getTeacherDashboard = asyncHandler(async (req, res) => {
  const teacherId = req.user._id;

  const [profile, upcomingBookings, recentEarnings, pendingBookings] = await Promise.all([
    TeacherProfile.findOne({ userId: teacherId })
      .select("stats verificationStatus isAvailable hourlyRatePaise")
      .lean(),

    Booking.find({
      teacherId,
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] },
      scheduledAt: { $gte: new Date() },
    })
      .populate("studentId", "name avatarUrl")
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),

    Payout.find({ teacherId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("amountPaise status createdAt settledAt")
      .lean(),

    Booking.find({ teacherId, status: BOOKING_STATUS.PENDING })
      .populate("studentId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const stats = profile?.stats || {};

  res.status(200).json(
    new ApiResponse(200, {
      stats: {
        totalStudents: stats.totalBookings || 0,
        completedSessions: stats.completedSessions || 0,
        totalEarningsRupees: (stats.totalEarningsPaise || 0) / 100,
        avgRating: stats.avgRating || 0,
        reviewCount: stats.reviewCount || 0,
        pendingPayoutRupees: (stats.pendingPayoutPaise || 0) / 100,
      },
      verificationStatus: profile?.verificationStatus || "pending",
      isAvailable: profile?.isAvailable || false,
      upcomingBookings,
      pendingBookings,
      recentEarnings,
    }, "Dashboard data fetched")
  );
});

// ── GET /api/v1/teachers/me/bookings ─────────────────────────────────────────
export const getTeacherBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { teacherId: req.user._id };
  if (status) filter.status = status;

  const result = await Booking.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { scheduledAt: -1 },
    populate: [{ path: "studentId", select: "name avatarUrl phone" }],
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Bookings fetched"));
});

// ── GET /api/v1/teachers/me/earnings ─────────────────────────────────────────
export const getTeacherEarnings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const teacherId = req.user._id;

  const [summary, payoutsResult] = await Promise.all([
    Payout.earningsSummary(teacherId),
    Payout.teacherEarnings(teacherId, {
      page: Number(page),
      limit: Math.min(Number(limit), 50),
    }),
  ]);

  // Build summary map
  const summaryMap = summary.reduce((acc, s) => {
    acc[s.status] = { totalRupees: s.totalRupees, count: s.count };
    return acc;
  }, {});

  res.status(200).json(
    new ApiResponse(200, {
      summary: summaryMap,
      payouts: paginate(payoutsResult),
    }, "Earnings fetched")
  );
});

// ── GET /api/v1/teachers/me/students ─────────────────────────────────────────
export const getTeacherStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const teacherId = req.user._id;

  // Aggregate unique students who had bookings with this teacher
  const pipeline = [
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), status: { $in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] } } },
    { $group: {
        _id: "$studentId",
        totalSessions: { $sum: 1 },
        lastSession: { $max: "$scheduledAt" },
        subjects: { $addToSet: "$subject" },
      }
    },
    { $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "student",
        pipeline: [{ $project: { name: 1, avatarUrl: 1, phone: 1, city: 1 } }],
      }
    },
    { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    pipeline.push({ $match: { "student.name": { $regex: search, $options: "i" } } });
  }

  const countPipeline = [...pipeline, { $count: "total" }];
  const skip = (Number(page) - 1) * Number(limit);
  pipeline.push({ $sort: { lastSession: -1 } }, { $skip: skip }, { $limit: Number(limit) });

  const [students, countResult] = await Promise.all([
    Booking.aggregate(pipeline),
    Booking.aggregate(countPipeline),
  ]);

  const total = countResult[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(200, {
      results: students,
      pagination: { total, pages: Math.ceil(total / limit), page: Number(page), limit: Number(limit) },
    }, "Students fetched")
  );
});