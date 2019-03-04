import { PassThrough } from "stream";
import { Response, FetchError } from "node-fetch";
import { logger, forget, stopWatch, Timer } from "../base";
import { AceApi, AceStreamSource, AceStreamInfo } from "../ace-api";
import { StreamConfig } from "../config";
import { StreamContextSharedBuffer } from "./StreamContextSharedBuffer";
import { StreamRequestResult } from "./types";

class StreamContext {
    response$: Promise<Response | null> | undefined;
    onStopped: (() => void) | undefined;

    private readonly streamConfig: StreamConfig;
    private readonly source: AceStreamSource;
    private readonly alias: string;
    private readonly aceApi: AceApi;
    private readonly clientStreams: Set<PassThrough> = new Set();
    private readonly sharedBuffer: StreamContextSharedBuffer;
    private readonly idleTimer: Timer;
    private info: AceStreamInfo;
    private isStopScheduled: boolean = false;

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
        this.sharedBuffer = new StreamContextSharedBuffer(streamConfig.sharedBufferLength);

        this.idleTimer = new Timer(streamConfig.responseTimeout, () => {
            logger.debug(`${this.alias} > response > idle timeout`);
            this.closeAllClientStreams();
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

    request(): StreamRequestResult {
        if (!this.response$) {
            throw new Error("Can't create a request for a non-open stream.");
        }

        const stream = new PassThrough();

        this.addClientStream(stream);

        stream.on("close", () => {
            this.removeClientStream(stream);
        });

        stream.on("finish", () => {
            this.removeClientStream(stream);
        });

        for (const chunk of this.sharedBuffer.chunks) {
            stream.write(chunk);
        }

        return {
            stream,
            response$: this.response$,
        };
    }

    updateInfo(info: AceStreamInfo): void {
        this.info = info;
    }

    private async initResponse(): Promise<Response | null> {
        const response = await this.requestStream();

        if (!response) {
            return null;
        }

        this.idleTimer.start();

        response.body.on("data", chunk => {
            this.idleTimer.reset();

            for (const stream of this.clientStreams) {
                try {
                    stream.write(chunk);
                }
                catch (err) {
                    logger.silly(`${this.alias} > response > stream write > ${err}`);
                    this.removeClientStream(stream);
                }
            }

            this.sharedBuffer.write(chunk);
        });

        response.body.on("error", (err) => {
            logger.debug(`${this.alias} > response > error`);
            logger.warn(`- ${err.message}`);
        });

        response.body.on("close", () => {
            logger.debug(`${this.alias} > response > closed`);

            this.idleTimer.stop();
            this.response$ = undefined;

            this.closeAllClientStreams();
        });

        response.body.on("finish", () => {
            logger.debug(`${this.alias} > response > finished`);

            this.idleTimer.stop();
            this.response$ = undefined;

            this.closeAllClientStreams();
        });

        return response;
    }

    private addClientStream(stream: PassThrough): void {
        this.clientStreams.add(stream);
    }

    private removeClientStream(stream: PassThrough): void {
        this.clientStreams.delete(stream);

        if (this.clientStreams.size === 0) {
            this.scheduleStopStream(this.streamConfig.stopDelay);
        }
    }

    private closeAllClientStreams(): void {
        const streams = Array.from(this.clientStreams.values());
        streams.forEach(s => s.end());
    }

    private async requestStream(): Promise<Response | null> {
        logger.debug(`${this.alias} > content ..`);
        try {
            const requestInit = {
                timeout: this.streamConfig.requestTimeout,
            };

            const { timeText, result: response } = await stopWatch(() => {
                return this.aceApi.getStream(this.info, requestInit);
            });

            logger.debug(`${this.alias} > content > response`);
            logger.debug(`- status: ${response.status} (${response.statusText})`);
            logger.debug(`- request time: ${timeText}`);

            return response;
        }
        catch (err) {
            logger.debug(`${this.alias} > content > failed`);

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

        logger.debug(`${this.alias} > schedule stop`);
        this.isStopScheduled = true;

        global.setTimeout(
            () => {
                if (this.clientStreams.size !== 0) {
                    logger.debug(`${this.alias} > schedule stop > canceled`);
                    this.isStopScheduled = false;
                    return;
                }

                this.scheduleStopStream(0);
            },
            this.streamConfig.stopDelay,
        );
    }

    private async stopStream(): Promise<void> {
        logger.debug(`${this.alias} > stop ..`);

        const { timeText, result: response } = await stopWatch(() => {
            return this.aceApi.stopStream(this.info);
        });

        logger.debug(`${this.alias} > stop > response`);
        logger.debug(`- status: ${response.status} (${response.statusText})`);
        logger.debug(`- request time: ${timeText}`);
    }
}

export { StreamContext }
