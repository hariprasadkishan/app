import { createLogger, format, transports } from "winston";
import env from "./env.config.js";

const { combine, timestamp, errors, json, colorize, printf, splat } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, correlationId, stack, ...meta }) => {
    const id  = correlationId ? ` [${correlationId}]` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return stack
      ? `${timestamp}${id} ${level}: ${message}${extra}\n${stack}`
      : `${timestamp}${id} ${level}: ${message}${extra}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

const logger = createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "trueed-backend" },
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new transports.Console()],
  exitOnError: false,
});

// Morgan stream
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;
