import { PassThrough } from "stream";
import { Response, FetchError } from "node-fetch";
import { logger, forget, stopWatch, Timer } from "../base";
import { AceApi, AceStreamSource, AceStreamInfo } from "../ace-api";
import { StreamConfig } from "../config";
import { StreamContextSharedBuffer } from "./StreamContextSharedBuffer";
import { StreamRequest } from "./types";

class StreamContext {
    response$: Promise<Response | null> | undefined;
    onStopped: (() => void) | undefined;

    private readonly streamConfig: StreamConfig;
    private readonly source: AceStreamSource;
    private readonly alias: string;
    private readonly aceApi: AceApi;
    private readonly requests: Set<StreamRequest>;
    private readonly sharedBuffer: StreamContextSharedBuffer;
    private readonly idleTimer: Timer;
    private info: AceStreamInfo;
    private isStopScheduled: boolean;

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
        this.alias = alias;
        this.aceApi = aceApi;
        this.requests = new Set();
        this.sharedBuffer = new StreamContextSharedBuffer(streamConfig.sharedBufferLength);
        this.isStopScheduled = false;

        this.idleTimer = new Timer(streamConfig.responseTimeout, () => {
            logger.debug(`Stream > ${this.alias} > response > idle timeout`);
            this.endAllRequests();
        });
    }

    open(): void {
        if (this.response$) {
            return;
        }

        this.response$ = this.initResponse();
    }

    async close(): Promise<void> {
        if (!this.response$) {
            return;
        }

        await this.stopStream();
    }

    createRequest(): StreamRequest {
        if (!this.response$) {
            throw new Error("Can't create a request for a non-open stream.");
        }

        const stream = new PassThrough();

        const request = {
            stream,
            response$: this.response$,
        };

        this.requests.add(request);

        stream.on("close", () => {
            this.deleteRequest(request);
        });

        stream.on("finish", () => {
            this.deleteRequest(request);
        });

        for (const chunk of this.sharedBuffer.chunks) {
            stream.write(chunk);
        }

        return request;
    }

    deleteRequest(request: StreamRequest): void {
        if (!this.requests.has(request)) {
            return;
        }

        this.requests.delete(request);

        if (this.requests.size === 0) {
            this.scheduleStopStream(this.streamConfig.stopDelay);
        }
    }

    updateInfo(info: AceStreamInfo): void {
        this.info = info;
    }

    private async initResponse(): Promise<Response | null> {
        let totalLength = 0;
        let startTime: number | null = null;
        let maxSpeed = 0;

        const response = await this.requestStream();

        if (!response) {
            return null;
        }

        this.idleTimer.start();

        response.body.on("data", chunk => {
            if (!startTime) {
                startTime = Date.now();
            }

            totalLength += chunk.length;

            const time = Date.now() - startTime;
            const speed = totalLength / (time / 1000);

            if (Number.isFinite(speed) && totalLength > 1024 * 1024 && speed > maxSpeed) {
                maxSpeed = speed;
                // logger.silly(`Stream > totalLength: ${(totalLength / 1024 / 1024).toFixed(2)} MiB, ${(time / 1000).toFixed(1)} s, ${(speed / 1024 / 1024).toFixed(2)} MiB/s`);
            }

            this.idleTimer.reset();

            for (const r of this.requests) {
                try {
                    r.stream.write(chunk);
                }
                catch (err) {
                    logger.silly(`Stream > ${this.alias} > response > stream write > ${err}`);
                    this.deleteRequest(r);
                }
            }

            this.sharedBuffer.write(chunk);
        });

        response.body.on("error", (err) => {
            logger.debug(`Stream > ${this.alias} > response > error`);
            logger.warn(`- ${err.message}`);
        });

        response.body.on("close", () => {
            logger.debug(`Stream > ${this.alias} > response > closed`);

            this.idleTimer.stop();
            this.response$ = undefined;

            this.endAllRequests();
        });

        response.body.on("finish", () => {
            logger.debug(`Stream > ${this.alias} > response > finished`);

            this.idleTimer.stop();
            this.response$ = undefined;

            this.endAllRequests();
        });

        return response;
    }

    private endAllRequests(): void {
        const requests = Array.from(this.requests.values());

        for (const r of requests) {
            r.stream.end();
        }
    }

    private async requestStream(): Promise<Response | null> {
        logger.debug(`Stream > ${this.alias} > content ..`);
        try {
            const requestInit = {
                timeout: this.streamConfig.requestTimeout,
            };

            const { timeText, result: response } = await stopWatch(() => {
                return this.aceApi.getStream(this.info, requestInit);
            });

            logger.debug(`Stream > ${this.alias} > content > response`);
            logger.debug(`- status: ${response.status} (${response.statusText})`);
            logger.debug(`- request time: ${timeText}`);

            return response;
        }
        catch (err) {
            logger.debug(`Stream > ${this.alias} > content > failed`);

            if (err instanceof FetchError) {
                logger.debug(`- ${err.message}`);
                return null;
            }

            throw err;
        }
    }

    private scheduleStopStream(stopDelay: number): void {
        if (stopDelay === 0) {
            forget(this.stopStream());
            this.onStopped && this.onStopped();
            return;
        }

        if (this.isStopScheduled) {
            return;
        }

        logger.debug(`Stream > ${this.alias} > schedule stop`);
        this.isStopScheduled = true;

        global.setTimeout(
            () => {
                if (this.requests.size !== 0) {
                    logger.debug(`Stream > ${this.alias} > schedule stop > canceled`);
                    this.isStopScheduled = false;
                    return;
                }

                this.scheduleStopStream(0);
            },
            this.streamConfig.stopDelay,
        );
    }

    private async stopStream(): Promise<void> {
        logger.debug(`Stream > ${this.alias} > stop ..`);

        const { timeText, result: response } = await stopWatch(() => {
            return this.aceApi.stopStream(this.info);
        });

        logger.debug(`Stream > ${this.alias} > stop > response`);
        logger.debug(`- status: ${response.status} (${response.statusText})`);
        logger.debug(`- request time: ${timeText}`);
    }
}

export { StreamContext }
