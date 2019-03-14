import { logger } from "./logger";

function forget<T>(promiseOrFn: Promise<T> | (() => Promise<T>)): void {
    const promise = typeof promiseOrFn === "function"
        ? promiseOrFn()
        : promiseOrFn
    ;

    promise.catch(err => logger.warn(err.stack || err));
}

export { forget }
