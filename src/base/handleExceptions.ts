import { logger } from "./logger";

function handleExceptions(): void {
    process.on("uncaughtException", err => {
        logger.warn(c => c`{bold Uncaught Exception}`);
        logger.warn(err.stack);
    });

    process.on("unhandledRejection", err => {
        logger.warn(c => c`{bold Unhandled Rejection}`);
        logger.warn(err.stack || err);
    });
}

export { handleExceptions }
