// Full corrected app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";              // ADD: http access logs via Winston stream

import corsOptions from "./config/cors.config.js";
import { securityMiddlewares, requestSizeLimits } from "./middlewares/security.middleware.js";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import { mongoSanitizeMiddleware, xssSanitizeMiddleware } from "./middlewares/sanitize.middleware.js";
import { globalLimiter } from "./middlewares/rateLimit.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import logger from "./config/logger.config.js";

// Routes (import once created)
// import authRoutes from "./routes/auth.routes.js";
// import teacherRoutes from "./routes/teacher.routes.js";
// import studentRoutes from "./routes/student.routes.js";
// import adminRoutes from "./routes/admin.routes.js";
// import webhookRoutes from "./routes/webhook.routes.js";

const app = express();

app.set("trust proxy", 1);

// Security headers, HPP, compression
app.use(securityMiddlewares);

// Correlation ID (must be before loggers)
app.use(correlationIdMiddleware);

// Structured HTTP access logs
app.use(morgan("combined", { stream: logger.stream }));

// Structured request logger (custom — logs userId, durationMs)
app.use(requestLoggerMiddleware);

// CORS
app.use(cors(corsOptions));

// ⚠️ Webhook route BEFORE json body parser — Razorpay needs raw body for signature verification
// app.use("/api/webhooks", webhookRoutes);

// Rate limiting (global)
app.use("/api", globalLimiter);

// Body parsing
app.use(express.json({ limit: requestSizeLimits.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimits.urlencodedLimit }));

// Cookie parser
app.use(cookieParser());

// Input sanitization (after body parsing, before routes)
app.use(mongoSanitizeMiddleware);
app.use(xssSanitizeMiddleware);

// Health check (before auth, no rate limit)
app.get("/health", (_req, res) => res.status(200).json({
  status: "ok",
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Mount routes
// app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/teachers", teacherRoutes);
// app.use("/api/v1/students", studentRoutes);
// app.use("/api/v1/admin", adminRoutes);

// 404 — after all routes
app.use(notFound);

// Error handler — MUST be last
app.use(errorHandler);

export default app;