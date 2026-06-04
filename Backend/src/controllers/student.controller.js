// src/controllers/student.controller.js
import { User, TeacherProfile, Booking, Payment } from "../models/index.js";
import { CloudinaryService } from "../services/cloudinary.service.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { paginate } from "../utils/pagination.util.js";
import { BOOKING_STATUS } from "../constants/enums.js";

// ── GET /api/v1/students/me/dashboard ────────────────────────────────────────
export const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const [upcomingSessions, completedCount, totalPaidRupees, recentTeachers] = await Promise.all([
    Booking.find({
      studentId,
      status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.IN_PROGRESS] },
      scheduledAt: { $gte: new Date() },
    })
      .populate("teacherId", "name avatarUrl")
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),

    Booking.countDocuments({ studentId, status: BOOKING_STATUS.COMPLETED }),

    Payment.aggregate([
      { $match: { studentId, status: "captured" } },
      { $group: { _id: null, total: { $sum: "$totalAmountPaise" } } },
    ]),

    Booking.find({ studentId, status: BOOKING_STATUS.COMPLETED })
      .populate("teacherId", "name avatarUrl")
      .sort({ scheduledAt: -1 })
      .limit(4)
      .select("teacherId subject scheduledAt")
      .lean(),
  ]);

  const totalPaid = totalPaidRupees[0]?.total ? totalPaidRupees[0].total / 100 : 0;

  res.status(200).json(
    new ApiResponse(200, {
      stats: {
        completedSessions: completedCount,
        upcomingSessions: upcomingSessions.length,
        totalSpentRupees: totalPaid,
      },
      upcomingSessions,
      recentTeachers: recentTeachers.map(b => b.teacherId).filter(Boolean),
    }, "Dashboard fetched")
  );
});

// ── GET /api/v1/students/me/bookings ─────────────────────────────────────────
export const getStudentBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { studentId: req.user._id };
  if (status) filter.status = status;

  const result = await Booking.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { scheduledAt: -1 },
    populate: [{ path: "teacherId", select: "name avatarUrl" }],
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Bookings fetched"));
});

// ── GET /api/v1/students/me/payments ─────────────────────────────────────────
export const getStudentPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await Payment.paginate(
    { studentId: req.user._id },
    {
      page: Number(page),
      limit: Math.min(Number(limit), 50),
      sort: { createdAt: -1 },
      populate: [
        { path: "bookingId", select: "subject scheduledAt durationMinutes" },
        { path: "teacherId", select: "name" },
      ],
      lean: true,
      leanWithId: true,
      customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
    }
  );

  res.status(200).json(new ApiResponse(200, paginate(result), "Payments fetched"));
});

// ── GET /api/v1/students/me/profile ──────────────────────────────────────────
export const getStudentProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-fcmTokens -walletBalance")
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { user }, "Profile fetched"));
});

// ── PUT /api/v1/students/me/profile ──────────────────────────────────────────
export const updateStudentProfile = asyncHandler(async (req, res) => {
  const ALLOWED = ["name", "email", "city"];
  const updates = {};

  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  if (updates.email) {
    const existing = await User.findOne({
      email: updates.email.toLowerCase(),
      _id: { $ne: req.user._id },
    });
    if (existing) {
      throw new ApiError(409, "Email already in use", [], "EMAIL_TAKEN");
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

// ── POST /api/v1/students/me/avatar ──────────────────────────────────────────
export const uploadStudentAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is required", [], "FILE_MISSING");
  }

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

// ── GET /api/v1/students/me/favourites ───────────────────────────────────────
export const getFavourites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("favourites")
    .populate({
      path: "favourites",
      model: "User",
      select: "name avatarUrl",
      // We populate teacher profiles separately
    })
    .lean();

  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  // Get teacher profiles for each favourite
  const favouriteIds = (user.favourites || []).map(f => (typeof f === "object" ? f._id : f));

  const profiles = await TeacherProfile.find({ userId: { $in: favouriteIds } })
    .select("userId stats hourlyRatePaise subjects city isAvailable verificationStatus")
    .populate("userId", "name avatarUrl")
    .lean({ virtuals: true });

  res.status(200).json(new ApiResponse(200, { favourites: profiles }, "Favourites fetched"));
});

// ── POST /api/v1/students/me/favourites/:teacherId ────────────────────────────
export const addFavourite = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;

  // Verify teacher exists and is approved
  const teacherProfile = await TeacherProfile.findOne({ userId: teacherId }).lean();
  if (!teacherProfile) {
    throw new ApiError(404, "Teacher not found", [], "TEACHER_NOT_FOUND");
  }

  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { favourites: teacherId },
  });

  res.status(200).json(new ApiResponse(200, null, "Added to favourites"));
});

// ── DELETE /api/v1/students/me/favourites/:teacherId ─────────────────────────
export const removeFavourite = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;

  await User.findByIdAndUpdate(req.user._id, {
    $pull: { favourites: teacherId },
  });

  res.status(200).json(new ApiResponse(200, null, "Removed from favourites"));
});