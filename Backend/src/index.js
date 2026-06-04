import { connectDB, disconnectDB } from "./db/index.js"; // Named import handles properly
import app from './app.js';
import env from './config/env.config.js';
import logger from './config/logger.config.js';

const port = env.PORT;
let server; // Keep a reference to the running server instance

connectDB()
.then(() => {
    server = app.listen(port, () => {
        logger.info(`🚀 TrueEd Server is running at port ${port} in ${env.NODE_ENV} mode`);
    });
})
.catch((error) => {
    logger.error(`💥 Critical application boot failure !!!`, error);
    process.exit(1);
});

// ==========================================
// GRACEFUL SHUTDOWN LAYER
// ==========================================
const shutdown = async (signal) => {
  logger.warn(`⚠️ ${signal} received — initiating graceful shutdown sequence`);
  
  if (server) {
    server.close(async () => {
      try {
        await disconnectDB(); // Database socket closure handles smoothly
        logger.info("🍃 MongoDB connection closed successfully");
        logger.info("🛑 TrueEd Server shutdown complete. Goodbye!");
        process.exit(0);
      } catch (err) {
        logger.error("💥 Error during database disconnection", err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force exit after 10 seconds if connections are hanging tight
  setTimeout(() => {
    logger.error("💥 Forcefully shutting down down after 10s timeout window");
    process.exit(1);
  }, 10000);
};

// Process lifecycle event listeners monitoring active node environment
process.on("SIGTERM", () => shutdown("SIGTERM")); // Container termination code
process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl + C local command termination

// ==========================================
// UNHANDLED SYSTEM CRASH OVERSEER
// ==========================================
process.on("uncaughtException", (err) => {
  logger.error("💥 FATAL SYSTEM EXCEPTION: Uncaught error in script", { 
    error: err.message, 
    stack: err.stack 
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("💥 FATAL PROMISE REJECTION: Unhandled async operational failure", { 
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  process.exit(1);
});