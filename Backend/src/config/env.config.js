import dotenv from "dotenv";
import { cleanEnv, str, num, bool, url, makeValidator } from "envalid";

dotenv.config(); // Load .env file into process.env

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
  FRONTEND_URL: str({ default: "http://localhost:5173" }), // Added for CORS/Redirects

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
  CLOUDINARY_FOLDER: str({ default: "trueed" }), // Added for asset categorization

  // ── Razorpay (future) ────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: str({ default: "" }),
  RAZORPAY_KEY_SECRET: str({ default: "" }),
  RAZORPAY_WEBHOOK_SECRET: str({ default: "" }),

  // ── Redis (future) ───────────────────────────────────────────────────────────
  REDIS_URL: str({ default: "" }),

  // ── Cookie & Logs ───────────────────────────────────────────────────────────
  COOKIE_DOMAIN: str({ default: "" }),
  REFRESH_TOKEN_COOKIE_DOMAIN: str({ default: "" }), // Added for secure refresh domains
  LOG_LEVEL: str({ choices: ["error", "warn", "info", "http", "debug"], default: "info" }), // Added for Winston control

  // ── Rate limiting & Uploads ─────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: num({ default: 15 * 60 * 1000 }),   // 15 min
  RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),
  MAX_FILE_SIZE_MB: num({ default: 10 }),
  MAX_CONCURRENT_UPLOADS: num({ default: 50 }),

  // ── SMS Gateways (Stubs management) ─────────────────────────────────────────
  SMS_PROVIDER: str({ choices: ["msg91", "fast2sms", "twilio", "mock"], default: "mock" }),
  MSG91_API_KEY: str({ default: "" }),
  MSG91_TEMPLATE_ID: str({ default: "" }),

  // ── Admin ───────────────────────────────────────────────────────────────────
  ADMIN_IDS: commaSeparatedList(),            // MongoDB ObjectId strings
});

export default env;