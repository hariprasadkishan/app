import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OtpSession, OTP_PURPOSE } from "../models/index.js";
import env from "../config/env.config.js";
import ApiError from "../utils/ApiError.js";
import logger from "../config/logger.config.js";

export const OtpService = {
  // Generates a 6-digit OTP, hashes it, persists it
  async generateAndSend(phone, purpose = OTP_PURPOSE.LOGIN, ipAddress = null) {
    // Rate limit check: max 5 OTPs per hour per phone
    const recentCount = await OtpSession.countRecentSends(phone, 3600000);
    if (recentCount >= 5) {
      throw new ApiError(429, "Too many OTP requests. Try again after 1 hour.", [], "OTP_RATE_LIMIT");
    }

    // Invalidate previous unverified OTPs for this phone+purpose
    await OtpSession.updateMany(
      { phone, purpose, verified: false },
      { $set: { expiresAt: new Date() } } // expire immediately
    );

    const otp = this._generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpSession.create({
      phone,
      purpose,
      otpHash,
      expiresAt,
      ipAddress,
      deliveryStatus: "pending",
    });

    // Send via SMS provider (stub — replace with Twilio/MSG91/Fast2SMS)
    await this._sendSms(phone, otp);

    logger.info("OTP generated", { phone: this._maskPhone(phone), purpose });
    return { expiresAt, maskedPhone: this._maskPhone(phone) };
  },

  async verify(phone, otp, purpose = OTP_PURPOSE.LOGIN) {
    const session = await OtpSession.findValid(phone, purpose);

    if (!session) {
      throw new ApiError(400, "OTP expired or not found. Request a new one.", [], "OTP_NOT_FOUND");
    }

    if (session.isLocked()) {
      throw new ApiError(429, "Too many failed attempts. Try again after 15 minutes.", [], "OTP_LOCKED");
    }

    const isValid = await bcrypt.compare(otp, session.otpHash);
    if (!isValid) {
      await session.incrementAttempt();
      throw new ApiError(400, "Invalid OTP", [], "OTP_INVALID");
    }

    // Generate one-time session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    await session.markVerified(sessionToken);

    return { sessionToken, phone };
  },

  async consumeSessionToken(sessionToken) {
    const session = await OtpSession.findOne({
      sessionToken,
      verified: true,
      sessionTokenUsed: false,
    }).select("+sessionToken");

    if (!session) {
      throw new ApiError(401, "Invalid or already-used session token.", [], "SESSION_TOKEN_INVALID");
    }

    await session.consumeSessionToken();
    return { phone: session.phone, purpose: session.purpose };
  },

  _generateOtp() {
    // Cryptographically secure 6-digit OTP
    return String(crypto.randomInt(100000, 999999));
  },

  _maskPhone(phone) {
    return phone.replace(/(\+?\d{2,3})\d{6}(\d{2})/, "$1******$2");
  },

  async _sendSms(phone, otp) {
    // TODO: Replace with actual SMS provider
    // MSG91, Fast2SMS, Twilio, etc.
    if (env.NODE_ENV !== "production") {
      logger.debug(`[DEV OTP] ${phone}: ${otp}`);
      return;
    }
    // await msg91Client.send(phone, `Your TrueEd OTP is ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes. Do not share.`);
    throw new Error("SMS provider not configured for production");
  },
};