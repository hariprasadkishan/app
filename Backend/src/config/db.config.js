import mongoose from "mongoose";
import env from "./env.config.js";
import logger from "./logger.config.js";

const MONGO_OPTIONS = {
  dbName:             env.DB_NAME,
  maxPoolSize:        10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:    45000,
};

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS);
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    logger.error("MongoDB connection failed", { error: err.message });
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () =>
  logger.warn("MongoDB disconnected")
);
mongoose.connection.on("reconnected", () =>
  logger.info("MongoDB reconnected")
);

// Sanitize query inputs — prevent NoSQL injection via $where, $regex abuse
mongoose.set("sanitizeFilter", true);

export default connectDB;
