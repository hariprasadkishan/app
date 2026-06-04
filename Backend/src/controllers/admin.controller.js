// src/controllers/admin.controller.js
import { User, TeacherProfile, Document, Booking, Payment, Payout, RefundRequest } from "../models/index.js";
import { NotificationService } from "../services/notification.service.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { validateObjectId } from "../utils/objectId.util.js";
import { paginate } from "../utils/pagination.util.js";
import { VERIFICATION_STATUS, BOOKING_STATUS, PAYOUT_STATUS, REFUND_STATUS } from "../constants/enums.js";
import logger from "../config/logger.config.js";

// ── GET /api/v1/admin/stats ───────────────────────────────────────────────────
export const getAdminStats = asyncHandler(async (req, res) => {
  const [
    totalTeachers,
    pendingKYC,
    totalStudents,
    totalSessions,
    revenueResult,
    pendingRefunds,
  ] = await Promise.all([
    User.countDocuments({ role: "teacher", deletedAt: null }),
    TeacherProfile.countDocuments({ verificationStatus: VERIFICATION_STATUS.PENDING }),
    User.countDocuments({ role: "student", deletedAt: null }),
    Booking.countDocuments({ status: BOOKING_STATUS.COMPLETED }),
    Payment.aggregate([
      { $match: { status: "captured" } },
      { $group: { _id: null, total: { $sum: "$commissionPaise" } } },
    ]),
    RefundRequest.countDocuments({ status: { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] } }),
  ]);

  const totalRevenuePaise = revenueResult[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(200, {
      totalTeachers,
      pendingKYC,
      totalStudents,
      totalSessions,
      totalRevenue: `₹${(totalRevenuePaise / 100).toLocaleString("en-IN")}`,
      totalRevenuePaise,
      pendingRefunds,
    }, "Admin stats fetched")
  );
});

// ── GET /api/v1/admin/teachers/pending ───────────────────────────────────────
export const getPendingTeachers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  const filter = { verificationStatus: VERIFICATION_STATUS.PENDING };

  const result = await TeacherProfile.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { createdAt: 1 }, // FIFO review queue
    populate: { path: "userId", select: "name phone email avatarUrl" },
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Pending teachers fetched"));
});

// ── GET /api/v1/admin/teachers ────────────────────────────────────────────────
export const getAllTeachers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const filter = {};
  if (status) filter.verificationStatus = status;

  const result = await TeacherProfile.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { createdAt: -1 },
    populate: { path: "userId", select: "name phone email avatarUrl kycStatus" },
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Teachers fetched"));
});

// ── GET /api/v1/admin/teachers/:teacherId ────────────────────────────────────
export const getTeacherDetail = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, "teacherId");

  const [profile, documents] = await Promise.all([
    TeacherProfile.findOne({ userId: teacherId })
      .populate("userId", "name phone email avatarUrl kycStatus createdAt")
      .lean({ virtuals: true }),
    Document.find({ teacherId, isActive: true }).lean(),
  ]);

  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", [], "PROFILE_NOT_FOUND");
  }

  res.status(200).json(new ApiResponse(200, { profile, documents }, "Teacher detail fetched"));
});

// ── POST /api/v1/admin/teachers/:teacherId/approve ────────────────────────────
export const approveTeacher = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, "teacherId");
  const { note } = req.body;

  const profile = await TeacherProfile.findOne({ userId: teacherId });
  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", [], "PROFILE_NOT_FOUND");
  }

  if (profile.verificationStatus === VERIFICATION_STATUS.APPROVED) {
    throw new ApiError(400, "Teacher is already approved", [], "ALREADY_APPROVED");
  }

  profile.verificationStatus = VERIFICATION_STATUS.APPROVED;
  profile.verifiedAt = new Date();
  profile.audit = {
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    reviewNote: note || "Approved",
    adminAction: "approved",
  };
  await profile.save();

  // Update user kycStatus
  await User.findByIdAndUpdate(teacherId, { kycStatus: "approved" });

  const teacher = await User.findById(teacherId).select("phone name").lean();
  if (teacher?.phone) {
    await NotificationService.sendSms(
      teacher.phone,
      `Congratulations ${teacher.name}! Your TrueEd teacher profile has been approved. You can now start accepting student bookings.`
    ).catch(() => {});
  }

  logger.info("Teacher approved", { teacherId, adminId: req.user._id, correlationId: req.correlationId });

  res.status(200).json(new ApiResponse(200, null, "Teacher approved successfully"));
});

// ── POST /api/v1/admin/teachers/:teacherId/reject ─────────────────────────────
export const rejectTeacher = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, "teacherId");
  const { reason } = req.body;

  if (!reason?.trim()) {
    throw new ApiError(400, "Rejection reason is required", [{ field: "reason", message: "Cannot be empty" }], "REASON_REQUIRED");
  }

  const profile = await TeacherProfile.findOne({ userId: teacherId });
  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", [], "PROFILE_NOT_FOUND");
  }

  profile.verificationStatus = VERIFICATION_STATUS.REJECTED;
  profile.rejectionReason = reason.trim();
  profile.audit = {
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    reviewNote: reason.trim(),
    adminAction: "rejected",
  };
  await profile.save();

  await User.findByIdAndUpdate(teacherId, { kycStatus: "rejected" });

  const teacher = await User.findById(teacherId).select("phone name").lean();
  if (teacher?.phone) {
    await NotificationService.sendSms(
      teacher.phone,
      `Hi ${teacher.name}, your TrueEd teacher profile verification was unsuccessful. Reason: ${reason}. Please login and re-submit with correct documents.`
    ).catch(() => {});
  }

  logger.info("Teacher rejected", { teacherId, adminId: req.user._id, reason });

  res.status(200).json(new ApiResponse(200, null, "Teacher rejected"));
});

// ── POST /api/v1/admin/teachers/:teacherId/suspend ────────────────────────────
export const suspendTeacher = asyncHandler(async (req, res) => {
  const teacherId = validateObjectId(req.params.teacherId, "teacherId");
  const { reason } = req.body;

  await TeacherProfile.findOneAndUpdate(
    { userId: teacherId },
    {
      verificationStatus: VERIFICATION_STATUS.SUSPENDED,
      isAvailable: false,
      $set: {
        "audit.reviewedBy": req.user._id,
        "audit.reviewedAt": new Date(),
        "audit.reviewNote": reason || "Suspended",
        "audit.adminAction": "suspended",
      },
    }
  );

  await User.findByIdAndUpdate(teacherId, { kycStatus: "rejected", isBanned: true, banReason: reason });

  logger.warn("Teacher suspended", { teacherId, adminId: req.user._id, reason });

  res.status(200).json(new ApiResponse(200, null, "Teacher suspended"));
});

// ── GET /api/v1/admin/bookings ────────────────────────────────────────────────
export const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const result = await Booking.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { createdAt: -1 },
    populate: [
      { path: "studentId", select: "name phone" },
      { path: "teacherId", select: "name phone" },
    ],
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Bookings fetched"));
});

// ── GET /api/v1/admin/refunds ─────────────────────────────────────────────────
export const getRefundRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  else filter.status = { $in: [REFUND_STATUS.REQUESTED, REFUND_STATUS.UNDER_REVIEW] };

  const result = await RefundRequest.paginate(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 50),
    sort: { createdAt: 1 },
    populate: [
      { path: "studentId", select: "name phone" },
      { path: "bookingId", select: "subject scheduledAt totalAmountPaise" },
    ],
    lean: true,
    leanWithId: true,
    customLabels: { docs: "results", totalDocs: "total", totalPages: "pages" },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Refund requests fetched"));
});

// ── POST /api/v1/admin/refunds/:refundId/approve ──────────────────────────────
export const approveRefund = asyncHandler(async (req, res) => {
  const refundId = validateObjectId(req.params.refundId, "refundId");
  const { approvedAmountPaise, note } = req.body;

  const refundRequest = await RefundRequest.findById(refundId);
  if (!refundRequest) {
    throw new ApiError(404, "Refund request not found", [], "REFUND_NOT_FOUND");
  }

  await refundRequest.approve({
    adminId: req.user._id,
    approvedAmountPaise: approvedAmountPaise || refundRequest.requestedAmountPaise,
    note: note || "",
  });

  // Update payment
  const payment = await Payment.findById(refundRequest.paymentId);
  if (payment) {
    await payment.addRefund({
      razorpayRefundId: `manual_${Date.now()}`,
      amountPaise: approvedAmountPaise || refundRequest.requestedAmountPaise,
      reason: note || "Admin approved refund",
    });

    // Update escrow
    payment.escrowStatus = "refunded";
    await payment.save();
  }

  // Update booking
  await Booking.findByIdAndUpdate(refundRequest.bookingId, { status: BOOKING_STATUS.REFUNDED });

  logger.info("Refund approved", { refundId, adminId: req.user._id });

  res.status(200).json(new ApiResponse(200, null, "Refund approved"));
});

// ── POST /api/v1/admin/refunds/:refundId/reject ───────────────────────────────
export const rejectRefund = asyncHandler(async (req, res) => {
  const refundId = validateObjectId(req.params.refundId, "refundId");
  const { reason } = req.body;

  if (!reason?.trim()) {
    throw new ApiError(400, "Rejection reason is required", [], "REASON_REQUIRED");
  }

  const refundRequest = await RefundRequest.findById(refundId);
  if (!refundRequest) {
    throw new ApiError(404, "Refund request not found", [], "REFUND_NOT_FOUND");
  }

  await refundRequest.reject({ adminId: req.user._id, reason: reason.trim() });

  logger.info("Refund rejected", { refundId, adminId: req.user._id });

  res.status(200).json(new ApiResponse(200, null, "Refund rejected"));
});

// ── GET /api/v1/admin/analytics/revenue ──────────────────────────────────────
export const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const [bookingRevenue, paymentSummary, topTeachers] = await Promise.all([
    Booking.revenueAnalytics(start, end),
    Payment.revenueSummary(start, end),
    TeacherProfile.topEarners(10),
  ]);

  res.status(200).json(
    new ApiResponse(200, { bookingRevenue, paymentSummary: paymentSummary[0] || {}, topTeachers }, "Revenue analytics fetched")
  );
});

// ── GET /api/v1/admin/users ───────────────────────────────────────────────────
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;

  const filter = { deletedAt: null };
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const result = await User.listPaginated(filter, {
    page: Number(page),
    limit: Math.min(Number(limit), 100),
    sort: { createdAt: -1 },
  });

  res.status(200).json(new ApiResponse(200, paginate(result), "Users fetched"));
});

// ── POST /api/v1/admin/users/:userId/ban ─────────────────────────────────────
export const banUser = asyncHandler(async (req, res) => {
  const userId = validateObjectId(req.params.userId, "userId");
  const { reason } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found", [], "USER_NOT_FOUND");
  }

  if (user.role === "admin") {
    throw new ApiError(403, "Cannot ban admin users", [], "FORBIDDEN");
  }

  await user.ban(reason);

  logger.warn("User banned", { userId, adminId: req.user._id, reason });

  res.status(200).json(new ApiResponse(200, null, "User banned"));
});