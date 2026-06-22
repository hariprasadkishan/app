import crypto from "crypto";
import bcrypt from "bcryptjs";
import env from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";
import { SmsService } from "./sms.service.js";
import { OTP_CONFIG } from "../constants/app.constants.js";
import { normalisePhone } from "../utils/validation.util.js";

// Late import to avoid circular dep with models/index.js at startup
const getOtpSession = async () => {
  const { OtpSession } = await import("../models/index.js");
  return OtpSession;
};

export const OtpService = {
  /**
   * Generate, hash, persist and send a 6-digit OTP.
   * Returns { expiresAt, maskedPhone }.
   */
  async generateAndSend(rawPhone, purpose, ipAddress = null) {
    const phone = normalisePhone(rawPhone);
    const OtpSession = await getOtpSession();

    // ── Rate guard (5 OTPs per hour per phone) ───────────────────────────────
    const recentCount = await OtpSession.countRecentSends(phone, OTP_CONFIG.MAX_PER_HOUR);
    if (recentCount >= OTP_CONFIG.MAX_PER_HOUR) {
      throw new ApiError(429, "Too many OTP requests. Try again after 1 hour.", [], "OTP_RATE_LIMIT");
    }

    // ── Expire existing unverified OTPs ──────────────────────────────────────
    await OtpSession.updateMany(
      { phone, purpose, verified: false },
      { $set: { expiresAt: new Date() } }
    );

    const otp      = this._generateOtp();
    const otpHash  = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpSession.create({
      phone,
      purpose,
      otpHash,
      expiresAt,
      ipAddress,
      deliveryStatus: "pending",
    });

    await SmsService.sendOtp(phone, otp, env.OTP_EXPIRY_MINUTES);

    logger.info("OTP generated", { phone: this._maskPhone(phone), purpose });
    return { expiresAt, maskedPhone: this._maskPhone(phone) };
  },

  /**
   * Verify OTP. Returns { sessionToken, phone } on success.
   */
  async verify(rawPhone, otp, purpose) {
    const phone = normalisePhone(rawPhone);
    const OtpSession = await getOtpSession();

    const session = await OtpSession.findValid(phone, purpose);
    if (!session) {
      throw new ApiError(400, "OTP expired or not found. Request a new one.", [], "OTP_NOT_FOUND");
    }

    if (session.isLocked()) {
      throw new ApiError(429, "Too many failed attempts. Try again after 15 minutes.", [], "OTP_LOCKED");
    }

    const isValid = await bcrypt.compare(String(otp), session.otpHash);
    if (!isValid) {
      await session.incrementAttempt();
      throw new ApiError(400, "Invalid OTP.", [], "OTP_INVALID");
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    await session.markVerified(sessionToken);

    return { sessionToken, phone };
  },

  /**
   * Consume a one-time session token (used after OTP verify to proceed with auth).
   * Returns { phone, purpose }.
   */
  async consumeSessionToken(sessionToken) {
    const OtpSession = await getOtpSession();

    const session = await OtpSession.findOne({
      sessionToken,
      verified:         true,
      sessionTokenUsed: false,
    }).select("+sessionToken");

    if (!session) {
      throw new ApiError(401, "Invalid or already-used session token.", [], "SESSION_TOKEN_INVALID");
    }

    await session.consumeSessionToken();
    return { phone: session.phone, purpose: session.purpose };
  },

  _generateOtp() {
    return String(crypto.randomInt(100000, 999999));
  },

  _maskPhone(phone) {
    return phone.replace(/(\+?\d{2,3})\d{6}(\d{2})/, "$1******$2");
  },
};
