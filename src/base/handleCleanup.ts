import nodeCleanup from "node-cleanup";
import { forget } from "./forget";
import { logger } from "./logger";

function handleCleanup(handler: () => any): void {
    nodeCleanup((exitCode, signal) => {
        console.log("");

        if (!signal) {
            return true;
        }

        nodeCleanup.uninstall();

        forget(async () => {
            logger.info("Cleaning up...");
            try {
                await handler();
                logger.info("Done.");
            }
            catch(err) {
                logger.error(err.stack || err);
                logger.info("Done with errors.");
            }
            finally {
                process.kill(process.pid, signal);
            }
        });

        return false;
    });
}

export { handleCleanup }
