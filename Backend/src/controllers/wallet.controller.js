// src/controllers/wallet.controller.js
import { Payment, TokenTransaction } from '../models/index.js';
import { WalletService }  from '../services/wallet.service.js';
import { PaymentService } from '../services/payment.service.js';
import { asyncHandler }   from '../utils/AsyncHandler.js';
import ApiError           from '../utils/ApiError.js';
import ApiResponse        from '../utils/ApiResponse.js';
import { PAYMENT_PURPOSE, PAYMENT_STATUS } from '../constants/enums.js';
import { PLATFORM_FEE } from '../constants/app.constants.js';
import logger            from '../config/logger.config.js';

// ── GET / — Get wallet balance ────────────────────────────────────────────────
export const getWallet = asyncHandler(async (req, res) => {
  const wallet = await WalletService.getOrCreate(req.user._id);
  res.status(200).json(new ApiResponse(200, {
    tokenBalance:        wallet.tokenBalance,
    cashBalancePaise:    wallet.cashBalancePaise,
    cashBalanceRupees:   wallet.cashBalancePaise / 100,
    totalTokensPurchased:wallet.totalTokensPurchased,
    totalTokensUsed:     wallet.totalTokensUsed,
  }, 'Wallet balance'));
});

// ── POST /tokens/checkout — Create token purchase order ───────────────────────
export const createTokenCheckout = asyncHandler(async (req, res) => {
  const order = await PaymentService.createTokenPurchaseOrder(req.user._id);

  await Payment.create({
    purpose:          PAYMENT_PURPOSE.TOKEN_PURCHASE,
    payerId:          req.user._id,
    totalAmountPaise: PLATFORM_FEE.TOKEN_PRICE_PAISE,
    tokensBought:     PLATFORM_FEE.TOKENS_PER_PURCHASE,
    status:           PAYMENT_STATUS.CREATED,
    razorpayOrderId:  order.id,
    idempotencyKey:   req.idempotencyKey || null,
  });

  logger.info('Token purchase order created', { userId: req.user._id, orderId: order.id });
  res.status(200).json(new ApiResponse(200, {
    razorpayOrder:   order,
    tokensBought:    PLATFORM_FEE.TOKENS_PER_PURCHASE,
    amountPaise:     PLATFORM_FEE.TOKEN_PRICE_PAISE,
  }, 'Payment order created'));
});

// ── POST /tokens/verify — Verify payment and credit tokens ───────────────────
export const verifyTokenPurchase = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw ApiError.badRequest('razorpayOrderId, razorpayPaymentId and razorpaySignature are required');
  }

  const isValid = PaymentService.verifyPaymentSignature({
    orderId:   razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });
  if (!isValid) throw new ApiError(400, 'Invalid payment signature', [], 'PAYMENT_SIGNATURE_INVALID');

  const payment = await Payment.findOne({
    razorpayOrderId,
    payerId:  req.user._id,
    purpose:  PAYMENT_PURPOSE.TOKEN_PURCHASE,
    status:   PAYMENT_STATUS.CREATED,
  });
  if (!payment) throw ApiError.notFound('Payment record');

  // Prevent double-credit
  const { default: mongoose } = await import('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await payment.capture({ razorpayPaymentId, razorpaySignature });
    await WalletService.creditTokens(req.user._id, payment._id, session);
    await session.commitTransaction();

    const wallet = await WalletService.getOrCreate(req.user._id);
    logger.info('Tokens credited', { userId: req.user._id, tokens: PLATFORM_FEE.TOKENS_PER_PURCHASE });
    res.status(200).json(new ApiResponse(200, {
      tokensAdded:  PLATFORM_FEE.TOKENS_PER_PURCHASE,
      tokenBalance: wallet.tokenBalance,
    }, `${PLATFORM_FEE.TOKENS_PER_PURCHASE} tokens credited`));
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── GET /transactions — Token transaction history ─────────────────────────────
export const getTokenTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await TokenTransaction.paginate(
    { studentId: req.user._id },
    {
      page: Number(page), limit: Math.min(Number(limit), 50),
      sort: { createdAt: -1 },
    },
  );

  res.status(200).json(new ApiResponse(200, result, 'Token transactions'));
});