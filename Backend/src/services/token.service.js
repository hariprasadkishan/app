import jwt from "jsonwebtoken";
import env from "../config/env.config.js";

export const TokenService = {
  generateAccessToken(payload) {
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
      algorithm: "HS256",
    });
  },

  generateRefreshToken(payload) {
    return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
      expiresIn: env.REFRESH_TOKEN_EXPIRY,
      algorithm: "HS256",
    });
  },

  verifyAccessToken(token) {
    return jwt.verify(token, env.ACCESS_TOKEN_SECRET);
  },

  verifyRefreshToken(token) {
    return jwt.verify(token, env.REFRESH_TOKEN_SECRET);
  },

  // Refresh token cookie options — security hardened
  getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days ms
      domain: env.COOKIE_DOMAIN || undefined,
      path: "/api/auth/refresh",  // ← Scope the cookie to refresh endpoint only
    };
  },

  getAccessCookieOptions() {
    return {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 min
      domain: env.COOKIE_DOMAIN || undefined,
    };
  },
};