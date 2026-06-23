// src/controllers/payout.controller.js
import { Payout, TeacherProfile, Payment } from '../models/index.js';
import { PaymentService }  from '../services/payment.service.js';
import { asyncHandler }    from '../utils/AsyncHandler.js';
import ApiError            from '../utils/ApiError.js';
import ApiResponse         from '../utils/ApiResponse.js';
import { PAYOUT_STATUS }   from '../constants/enums.js';
import logger              from '../config/logger.config.js';

// ── GET /payouts — Teacher: list own payouts ──────────────────────────────────
export const getMyPayouts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { teacherId: req.user._id };
  if (status) filter.status = status;

  const result = await Payout.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 50),
    sort: { createdAt: -1 },
    populate: { path: 'classroomId', select: 'title subject' },
    select: '-bankAccount.razorpayContactId -bankAccount.razorpayFundId',
  });

  res.status(200).json(new ApiResponse(200, result, 'Payout history'));
});

// ── POST /payouts/withdraw — Teacher requests withdrawal of wallet balance ────
export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amountPaise } = req.body;
  if (!amountPaise || Number(amountPaise) < 100) {
    throw ApiError.badRequest('Minimum withdrawal is ₹1 (100 paise)');
  }

  const profile = await TeacherProfile.findOne({ userId: req.user._id })
    .select('walletPaise bankAccount stats')
    .lean();

  if (!profile) throw ApiError.notFound('Teacher profile');
  if (!profile.bankAccount?.ifsc) {
    throw ApiError.badRequest('Please add your bank account details before requesting a withdrawal');
  }

  const requestedPaise = Math.round(Number(amountPaise));
  if (profile.walletPaise < requestedPaise) {
    throw new ApiError(402, `Insufficient wallet balance. Available: ₹${(profile.walletPaise / 100).toFixed(2)}`, [], 'INSUFFICIENT_BALANCE');
  }

  // Debit wallet
  await TeacherProfile.findOneAndUpdate(
    { userId: req.user._id, walletPaise: { $gte: requestedPaise } },
    { $inc: { walletPaise: -requestedPaise } },
  );

  // Create payout record (admin/cron processes the actual bank transfer)
  const payout = await Payout.create({
    teacherId:              req.user._id,
    classroomId:            null,
    grossFeesCollectedPaise: requestedPaise,
    teacherPayoutPaise:     requestedPaise,
    platformFeePaise:       0,
    studentRefundTotalPaise: 0,
    status:                 PAYOUT_STATUS.QUEUED,
    bankAccount:            {
      accountHolderName: profile.bankAccount.accountHolderName,
      accountLast4:      profile.bankAccount.accountLast4,
      ifsc:              profile.bankAccount.ifsc,
      bankName:          profile.bankAccount.bankName,
    },
  });

  logger.info('Withdrawal requested', { teacherId: req.user._id, amountPaise: requestedPaise, payoutId: payout._id });
  res.status(201).json(new ApiResponse(201, {
    payoutId:    payout._id,
    amountPaise: requestedPaise,
    status:      PAYOUT_STATUS.QUEUED,
  }, 'Withdrawal request submitted'));
});

// ── GET /payouts/:payoutId — Get single payout detail ────────────────────────
export const getPayoutDetail = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;

  const payout = await Payout.findOne({ _id: payoutId, teacherId: req.user._id })
    .populate('classroomId', 'title subject')
    .select('-bankAccount.razorpayContactId -bankAccount.razorpayFundId')
    .lean({ virtuals: true });

  if (!payout) throw ApiError.notFound('Payout');
  res.status(200).json(new ApiResponse(200, payout, 'Payout detail'));
});

// ── Admin: GET /admin/payouts — All payouts ───────────────────────────────────
export const adminGetAllPayouts = asyncHandler(async (req, res) => {
  const { status, teacherId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status)    filter.status    = status;
  if (teacherId) filter.teacherId = teacherId;

  const result = await Payout.paginate(filter, {
    page: Number(page), limit: Math.min(Number(limit), 100),
    sort: { createdAt: -1 },
    populate: [
      { path: 'teacherId',   select: 'name phone' },
      { path: 'classroomId', select: 'title subject' },
    ],
  });

  res.status(200).json(new ApiResponse(200, result, 'All payouts'));
});

// ── Admin: PATCH /admin/payouts/:payoutId/hold ────────────────────────────────
export const adminHoldPayout = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;
  const { reason }   = req.body;
  if (!reason?.trim()) throw ApiError.badRequest('reason is required');

  logger.warn('ADMIN_ACTION', {
    adminId: req.user._id, action: 'HOLD_PAYOUT', correlationId: req.correlationId, payload: { payoutId, reason },
  });

  const payout = await Payout.findById(payoutId);
  if (!payout) throw ApiError.notFound('Payout');

  await payout.putOnHold(reason, req.user._id);
  res.status(200).json(new ApiResponse(200, null, 'Payout put on hold'));
});

// ── Admin: PATCH /admin/payouts/:payoutId/release ─────────────────────────────
export const adminReleasePayout = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;

  logger.warn('ADMIN_ACTION', {
    adminId: req.user._id, action: 'RELEASE_PAYOUT', correlationId: req.correlationId, payload: { payoutId },
  });

  const payout = await Payout.findById(payoutId);
  if (!payout) throw ApiError.notFound('Payout');

  await payout.releaseHold(req.user._id);
  res.status(200).json(new ApiResponse(200, null, 'Payout hold released'));
});