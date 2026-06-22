// ─────────────────────────────────────────────────────────────────────────────
// src/services/wallet.service.js
// Completely synchronized with updated StudentWallet and TokenTransaction schemas.
// ─────────────────────────────────────────────────────────────────────────────
import { StudentWallet, TokenTransaction } from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";
import { PLATFORM_FEE } from "../constants/app.constants.js";
import { TOKEN_TRANSACTION_TYPE } from "../constants/enums.js";

export const WalletService = {
  async getOrCreate(studentId) {
    let wallet = await StudentWallet.findOne({ studentId });
    if (!wallet) {
      wallet = await StudentWallet.create({ studentId, tokenBalance: 0, cashBalancePaise: 0 });
    }
    return wallet;
  },

  async creditTokens(studentId, paymentId, session = null) {
    const tokens = PLATFORM_FEE.TOKENS_PER_PURCHASE;
    const wallet = await StudentWallet.findOneAndUpdate(
      { studentId },
      { $inc: { tokenBalance: tokens } },
      { new: true, upsert: true, session }
    );

    await TokenTransaction.create(
      [{
        studentId,
        walletId: wallet._id,
        type: TOKEN_TRANSACTION_TYPE.PURCHASED,
        amount: tokens,
        balanceAfter: wallet.tokenBalance,
        paymentId,
        note: `Purchased ${tokens} tokens for ₹${PLATFORM_FEE.TOKEN_PRICE_PAISE / 100}`,
      }],
      { session }
    );

    logger.info("Tokens credited internally", { studentId, tokens, balance: wallet.tokenBalance });
    return wallet;
  },

  async debitToken(studentId, queryId, classroomId, session = null) {
    const wallet = await StudentWallet.findOneAndUpdate(
      { studentId, tokenBalance: { $gte: 1 } },
      { $inc: { tokenBalance: -1 } },
      { new: true, session }
    );

    if (!wallet) {
      throw new ApiError(402, "Insufficient tokens. Please purchase more.", [], "INSUFFICIENT_TOKENS");
    }

    await TokenTransaction.create(
      [{
        studentId,
        walletId: wallet._id,
        type: TOKEN_TRANSACTION_TYPE.USED,
        amount: -1,
        balanceAfter: wallet.tokenBalance,
        queryId,
        note: "Token used to send enrollment query",
      }],
      { session }
    );

    return wallet;
  },

  async refundToken(studentId, queryId, reason, session = null) {
    const wallet = await StudentWallet.findOneAndUpdate(
      { studentId },
      { $inc: { tokenBalance: 1 } },
      { new: true, upsert: true, session }
    );

    await TokenTransaction.create(
      [{
        studentId,
        walletId: wallet._id,
        type: TOKEN_TRANSACTION_TYPE.REFUNDED,
        amount: 1,
        balanceAfter: wallet.tokenBalance,
        queryId,
        note: reason || "Token refunded due to query rejection/expiry",
      }],
      { session }
    );

    return wallet;
  },
};