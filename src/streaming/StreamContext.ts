import { PassThrough } from "stream";
import { Response, FetchError } from "node-fetch";
import { createLogger, forget, stopWatch, splitLines, Logger, Timer } from "../base";
import { AceApi, AceStreamSource, AceStreamInfo } from "../ace-api";
import { StreamConfig } from "../config";
import { StreamContextSharedBuffer } from "./StreamContextSharedBuffer";
import { StreamRequest } from "./types";

class StreamContext {
    response$: Promise<Response | null> | null;
    onClosed: (() => void) | undefined;

    private readonly streamConfig: StreamConfig;
    private readonly source: AceStreamSource;
    private readonly logger: Logger;
    private readonly aceApi: AceApi;
    private readonly requests: Set<StreamRequest>;
    private readonly sharedBuffer: StreamContextSharedBuffer;
    private readonly idleTimer: Timer;
    private isOpened: boolean;
    private info: AceStreamInfo;

    constructor(
        streamConfig: StreamConfig,
        source: AceStreamSource,
        info: AceStreamInfo,
        alias: string,
        aceApi: AceApi,
    ) {
        this.streamConfig = streamConfig;
        this.source = source;
        this.info = info;
        this.logger = createLogger(c => c`{green Stream > ${alias}}`);
        this.aceApi = aceApi;
        this.requests = new Set();
        this.sharedBuffer = new StreamContextSharedBuffer(streamConfig.sharedBufferLength);
        this.isOpened = false;
        this.response$ = null;

        this.idleTimer = new Timer(streamConfig.responseTimeout, () => {
            this.logger.debug(`response > idle timeout`);
            this.closeSelf();
        });
    }

    open(): void {
        if (this.isOpened) {
            return;
        }

        this.isOpened = true;
        this.response$ = this.initResponse();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.logger.debug(`close`);

        this.isOpened = false;
        this.response$ = null;
        this.idleTimer.stop();
        this.endAllRequests();

        await this.stopStream();
    }

    createRequest(): StreamRequest {
        if (!this.isOpened || !this.response$) {
            throw new Error("Can't create a request for a non-open stream.");
        }

        const stream = new PassThrough();

        const request = {
            stream,
            response$: this.response$,
        };

        stream.on("close", () => {
            this.deleteRequest(request);
        });

        stream.on("finish", () => {
            this.deleteRequest(request);
        });

        for (const chunk of this.sharedBuffer.chunks) {
            stream.write(chunk);
        }

        this.requests.add(request);

        return request;
    }

    deleteRequest(request: StreamRequest): void {
        if (!this.requests.has(request)) {
            return;
        }

        this.requests.delete(request);

        if (this.requests.size === 0) {
            this.scheduleClose();
        }
    }

    updateInfo(info: AceStreamInfo): void {
        this.info = info;
    }

    private async initResponse(): Promise<Response | null> {
        const response = await this.requestStream();

        if (!this.isOpened) {
            return null;
        }

        if (!response) {
            this.closeSelf();
            return null;
        }

        this.idleTimer.start();

        response.body.on("data", chunk => {
            this.idleTimer.reset();

            for (const r of this.requests) {
                try {
                    r.stream.write(chunk);
                }
                catch (err) {
                    this.logger.silly(`response > stream write > ${err}`);
                    this.deleteRequest(r);
                }
            }

            this.sharedBuffer.write(chunk);
        });

        response.body.on("error", (err) => {
            this.logger.warn(`response > error`, [err.message]);
        });

        response.body.on("close", () => {
            if (!this.isOpened) {
                return;
            }

            this.logger.debug(`response > closed`);
            this.closeSelf();
        });

        response.body.on("finish", () => {
            if (!this.isOpened) {
                return;
            }

            this.logger.debug(`response > finished`);
            this.closeSelf();
        });

        return response;
    }

    private endAllRequests(): void {
        const requests = Array.from(this.requests.values());
        this.requests.clear();

        for (const r of requests) {
            r.stream.end();
        }
    }

    private async requestStream(): Promise<Response | null> {
        this.logger.debug(`ace engine > request content ..`);
        try {
            const { timeText, result: response } = await stopWatch(() => {
                return this.aceApi.getStreamByInfo(this.info);
            });

            this.logger.debug(`ace engine > request content > response`, [
                c => c`status: {bold ${response.status.toString()} (${response.statusText})}`,
                c => c`request time: {bold ${timeText}}`,
            ]);

            if (response.status !== 200) {
                return null;
            }

            return response;
        }
        catch (err) {
            this.logger.debug(`ace engine > request content > failed`);

            if (err instanceof FetchError) {
                this.logger.debug(err.message);
                return null;
            }

            throw err;
        }
    }

    private scheduleClose(): void {
        this.logger.debug(`schedule close`);

        global.setTimeout(
            () => {
                if (!this.isOpened) {
                    return;
                }

                if (this.requests.size !== 0) {
                    this.logger.debug(`schedule close > canceled`);
                    return;
                }

                this.closeSelf();
            },
            this.streamConfig.stopDelay,
        );
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }

    private async stopStream(): Promise<void> {
        this.logger.debug(`ace engine > stop request ..`);

        const { timeText, result: response } = await stopWatch(() => {
            return this.aceApi.stopStreamByInfo(this.info);
        });

        this.logger.debug(`ace engine > stop request > response`, [
            c => c`status: {bold ${response.status.toString()} (${response.statusText})}`,
            c => c`request time: {bold ${timeText}}`,
        ]);
    }
}

export { StreamContext }
