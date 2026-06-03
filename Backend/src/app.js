import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import corsOptions from "./config/cors.config.js";

import { securityMiddlewares, requestSizeLimits } from "./middlewares/security.middleware.js";
import { correlationIdMiddleware } from "./middlewares/correlationId.middleware.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.middleware.js";
import { mongoSanitizeMiddleware, xssSanitizeMiddleware } from "./middlewares/sanitize.middleware.js";
import { globalLimiter } from "./middlewares/rateLimit.middleware.js";

const app = express();

app.set("trust proxy", 1);

app.use(securityMiddlewares);

app.use(correlationIdMiddleware);

app.use(requestLoggerMiddleware);

app.use(cors(corsOptions));

app.use("/api", globalLimiter);

app.use(express.json({ limit: requestSizeLimits.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimits.urlencodedLimit }));

app.use(mongoSanitizeMiddleware);

app.use(xssSanitizeMiddleware);

app.use(cookieParser());


export default app;