import { connectDB } from "./db/index.js";
import app from './app.js';
import env from './config/env.config.js';
import logger from './config/logger.config.js';

const port = env.PORT;

connectDB()
.then(() => {
    app.listen(port, () => {
        logger.info(`🚀 TrueEd Server is running at port ${port} in ${env.NODE_ENV} mode`);
    });
})
.catch((error) => {
    logger.error(`💥 Critical application boot failure !!!`, error);
});