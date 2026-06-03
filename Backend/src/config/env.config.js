/**
 * env.config.js
 *
 * Centralised, validated environment configuration.
 *
 * WHY: "Fail fast" on startup — if a required env var is missing we crash
 * immediately with a clear error rather than discovering it at runtime when
 * a request is already in-flight.  All consumer modules import from here
 * instead of calling process.env directly, keeping configuration in one place
 * and making secrets easy to mock in tests.
 *
 * SCALABILITY: Add new vars here once; every service gets them automatically.
 */

import { cleanEnv, str, num, bool, url, makeValidator } from "envalid";

// ─── Custom validators ────────────────────────────────────────────────────────

const commaSeparatedList = makeValidator((x) => {
  if (typeof x !== "string" || x.trim() === "")
    throw new Error("Expected a non-empty comma-separated string");
  return x.split(",").map((s) => s.trim());
});

// ─── Validation & export ──────────────────────────────────────────────────────

const env = cleanEnv(process.env, {
  // ── Server ──────────────────────────────────────────────────────────────────
  NODE_ENV: str({ choices: ["development", "test", "production"] }),
  PORT: num({ default: 8000 }),

  // ── MongoDB ─────────────────────────────────────────────────────────────────
  MONGODB_URI: str(),
  DB_NAME: str({ default: "edtech_platform" }),

  // ── JWT ─────────────────────────────────────────────────────────────────────
  ACCESS_TOKEN_SECRET: str(),
  ACCESS_TOKEN_EXPIRY: str({ default: "15m" }),
  REFRESH_TOKEN_SECRET: str(),
  REFRESH_TOKEN_EXPIRY: str({ default: "7d" }),

  // ── OTP ─────────────────────────────────────────────────────────────────────
  OTP_SECRET: str(),                          // HMAC key for OTP signing
  OTP_EXPIRY_MINUTES: num({ default: 10 }),
  OTP_MAX_ATTEMPTS: num({ default: 5 }),

  // ── CORS ────────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: commaSeparatedList(),      // "https://app.example.com,..."

  // ── Cloudinary ──────────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: str(),
  CLOUDINARY_API_KEY: str(),
  CLOUDINARY_API_SECRET: str(),

  // ── Razorpay (future) ────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: str({ default: "" }),
  RAZORPAY_KEY_SECRET: str({ default: "" }),
  RAZORPAY_WEBHOOK_SECRET: str({ default: "" }),

  // ── Redis (future) ───────────────────────────────────────────────────────────
  REDIS_URL: str({ default: "" }),

  // ── Cookie ──────────────────────────────────────────────────────────────────
  COOKIE_DOMAIN: str({ default: "" }),

  // ── Rate limiting ────────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: num({ default: 15 * 60 * 1000 }),   // 15 min
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),

  // ── Upload ──────────────────────────────────────────────────────────────────
  MAX_FILE_SIZE_MB: num({ default: 10 }),

  // ── Admin ───────────────────────────────────────────────────────────────────
  ADMIN_IDS: commaSeparatedList(),            // MongoDB ObjectId strings
});

export default env;