// ─────────────────────────────────────────────────────────────────────────────
// src/services/wallet.service.js
// Student token wallet — purchases, consumption, and refunds.
// All DB writes happen inside transactions where atomicity matters.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";
import { PLATFORM_FEE } from "../constants/app.constants.js";
import { TOKEN_TRANSACTION_TYPE } from "../constants/enums.js";

const getModels = async () => {
  const { StudentWallet, TokenTransaction } = await import("../models/index.js");
  return { StudentWallet, TokenTransaction };
};

export const WalletService = {
  /**
   * Get (or create) a student's wallet.
   */
  async getOrCreate(studentId) {
    const { StudentWallet } = await getModels();
    let wallet = await StudentWallet.findOne({ student: studentId });
    if (!wallet) {
      wallet = await StudentWallet.create({ student: studentId, tokenBalance: 0 });
    }
    return wallet;
  },

  /**
   * Credit tokens after a successful ₹19 payment.
   * paymentId: the Payment document _id for audit.
   */
  async creditTokens(studentId, paymentId, session = null) {
    const { StudentWallet, TokenTransaction } = await getModels();
    const tokens = PLATFORM_FEE.TOKENS_PER_PURCHASE;

    const wallet = await StudentWallet.findOneAndUpdate(
      { student: studentId },
      { $inc: { tokenBalance: tokens } },
      { new: true, upsert: true, session }
    );

    await TokenTransaction.create(
      [{
        student:     studentId,
        type:        TOKEN_TRANSACTION_TYPE.PURCHASED,
        tokens,
        balanceAfter: wallet.tokenBalance,
        payment:     paymentId,
        note:        `Purchased ${tokens} tokens for ₹${PLATFORM_FEE.TOKEN_PRICE_PAISE / 100}`,
      }],
      { session }
    );

    logger.info("Tokens credited", { studentId, tokens, balance: wallet.tokenBalance });
    return wallet;
  },

  /**
   * Deduct 1 token when a student sends an enrollment query.
   * Throws 402 if insufficient balance.
   */
  async deductToken(studentId, queryId, classroomId, session = null) {
    const { StudentWallet, TokenTransaction } = await getModels();

    const wallet = await StudentWallet.findOneAndUpdate(
      { student: studentId, tokenBalance: { $gte: 1 } },
      { $inc: { tokenBalance: -1 } },
      { new: true, session }
    );

    if (!wallet) {
      throw new ApiError(402, "Insufficient tokens. Please purchase more.", [], "INSUFFICIENT_TOKENS");
    }

    await TokenTransaction.create(
      [{
        student:      studentId,
        type:         TOKEN_TRANSACTION_TYPE.USED,
        tokens:       -1,
        balanceAfter: wallet.tokenBalance,
        query:        queryId,
        classroom:    classroomId,
        note:         "Token used to send enrollment query",
      }],
      { session }
    );

    return wallet;
  },

  /**
   * Refund 1 token when a query is rejected or auto-expired.
   */
  async refundToken(studentId, queryId, reason, session = null) {
    const { StudentWallet, TokenTransaction } = await getModels();

    const wallet = await StudentWallet.findOneAndUpdate(
      { student: studentId },
      { $inc: { tokenBalance: 1 } },
      { new: true, upsert: true, session }
    );

    await TokenTransaction.create(
      [{
        student:      studentId,
        type:         TOKEN_TRANSACTION_TYPE.REFUNDED,
        tokens:       1,
        balanceAfter: wallet.tokenBalance,
        query:        queryId,
        note:         reason || "Token refunded due to query rejection/expiry",
      }],
      { session }
    );

    logger.info("Token refunded", { studentId, queryId, balance: wallet.tokenBalance });
    return wallet;
  },

  /**
   * Admin bonus tokens.
   */
  async grantBonus(studentId, tokens, adminId, note = "") {
    const { StudentWallet, TokenTransaction } = await getModels();

    const wallet = await StudentWallet.findOneAndUpdate(
      { student: studentId },
      { $inc: { tokenBalance: tokens } },
      { new: true, upsert: true }
    );

    await TokenTransaction.create([{
      student:      studentId,
      type:         TOKEN_TRANSACTION_TYPE.BONUS,
      tokens,
      balanceAfter: wallet.tokenBalance,
      note:         note || `Admin bonus: ${tokens} tokens`,
      grantedBy:    adminId,
    }]);

    return wallet;
  },

  async getBalance(studentId) {
    const { StudentWallet } = await getModels();
    const wallet = await StudentWallet.findOne({ student: studentId }).lean();
    return wallet?.tokenBalance ?? 0;
  },
};
