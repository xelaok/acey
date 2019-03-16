import { logger } from "./logger";
import { formatErrorMessage } from "./formatErrorMessage";

function forget<T>(promiseOrFn: Promise<T> | (() => Promise<T>)): void {
    const promise = typeof promiseOrFn === "function"
        ? promiseOrFn()
        : promiseOrFn
    ;

    promise.catch(err => {
        logger.silly(`forget() catch:`, [formatErrorMessage(err)]);
    });
}

export { forget }
