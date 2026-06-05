// src/app.js

import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import morgan       from 'morgan';

// Config & init (order matters)
import './config/cloudinary.config.js';

import corsOptions                                            from './config/cors.config.js';
import { securityMiddlewares, requestSizeLimits }            from './middlewares/security.middleware.js';
import { correlationIdMiddleware }                           from './middlewares/correlationId.middleware.js';
import { requestLoggerMiddleware }                           from './middlewares/requestLogger.middleware.js';
import { mongoSanitizeMiddleware, xssSanitizeMiddleware }    from './middlewares/sanitize.middleware.js';
import { globalLimiter }                                     from './middlewares/rateLimit.middleware.js';
import { errorHandler }                                      from './middlewares/errorHandler.middleware.js';
import { notFound }                                          from './middlewares/notFound.middleware.js';
import logger                                                from './config/logger.config.js';

import authRoutes    from './routes/auth.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import reviewRoutes  from './routes/review.routes.js';
import adminRoutes   from './routes/admin.routes.js';
import payoutRoutes  from './routes/payout.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(securityMiddlewares);
app.use(correlationIdMiddleware);
app.use(morgan('combined', { stream: logger.stream }));
app.use(requestLoggerMiddleware);
app.use(cors(corsOptions));

// Webhook BEFORE json body parser — Razorpay needs raw bytes for HMAC
app.use('/api/webhooks', webhookRoutes);

app.use('/api', globalLimiter);

app.use(express.json({ limit: requestSizeLimits.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimits.urlencodedLimit }));
app.use(cookieParser());

app.use(mongoSanitizeMiddleware);
app.use(xssSanitizeMiddleware);

app.get('/health', (_req, res) =>
  res.status(200).json({
    status:    'ok',
    uptime:    Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
  }),
);

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/teachers',      teacherRoutes);
app.use('/api/v1/students',      studentRoutes);
app.use('/api/v1/bookings',      bookingRoutes);
app.use('/api/v1/payments',      paymentRoutes);
app.use('/api/v1/reviews',       reviewRoutes);
app.use('/api/v1/admin',         adminRoutes);
app.use('/api/v1/admin/payouts', payoutRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;