import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{9,14}$/;
const otpRegex = /^\d{6}$/;

export const sendOtpSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number"),
  purpose: z.enum(["login", "register", "reset", "phone_change"]).default("login"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number"),
  otp: z.string().regex(otpRegex, "OTP must be 6 digits"),
  purpose: z.enum(["login", "register", "reset", "phone_change"]).default("login"),
});

export const registerSchema = z.object({
  sessionToken: z.string().min(32, "Invalid session token"),
  name: z.string().trim().min(2).max(80),
  email: z.string().email().optional(),
  role: z.enum(["student", "teacher"]),
  city: z.string().trim().min(2).max(100).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(), // Also from cookie
});