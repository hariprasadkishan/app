import rateLimit from "express-rate-limit";
import env from "./env.config.js";

const defaults = {
  standardHeaders: true,   // Return RateLimit-* headers
  legacyHeaders:   false,
  skipSuccessfulRequests: false,
  handler(req, res) {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: "Too many requests. Please try again later.",
      errorCode: "RATE_LIMITED",
    });
  },
};

/** General API limiter */
export const apiLimiter = rateLimit({
  ...defaults,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max:      env.RATE_LIMIT_MAX_REQUESTS,
});

/** Auth routes — login / register */
export const authLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000, // 15 min
  max:      env.LOGIN_RATE_LIMIT_MAX,
  message:  undefined,
  handler(req, res) {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: "Too many auth attempts. Please wait 15 minutes.",
      errorCode: "AUTH_RATE_LIMITED",
    });
  },
});

/** OTP request limiter */
export const otpLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      env.OTP_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.body?.phone || req.ip,
  handler(req, res) {
    res.status(429).json({
      success: false,
      statusCode: 429,
      message: "Too many OTP requests. Try again after 1 hour.",
      errorCode: "OTP_RATE_LIMITED",
    });
  },
});

/** File upload limiter */
export const uploadLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 60 * 1000,
  max:      env.MAX_CONCURRENT_UPLOADS,
});

/** Payment / webhook limiter — very tight */
export const paymentLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000, // 1 min
  max:      20,
});

/** Admin actions */
export const adminLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  max:      200,
});

/** Search limiter — prevent scraping */
export const searchLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max:      30,
});
