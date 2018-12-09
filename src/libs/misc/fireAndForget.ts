import { logger } from "../logger";

function fireAndForget(handler: () => Promise<void>): void {
    handler().catch(err => {
        logger.warn(err.stack);
    });
}

export { fireAndForget }
