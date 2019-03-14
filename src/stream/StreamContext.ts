import { PassThrough } from "stream";
import { Response } from "node-fetch";
import { createLogger, forget, stopWatch, Logger, Timer, GatewayError } from "../base";
import { AceClient, AceStreamSource, AceStreamInfo } from "../ace-client";
import { StreamConfig } from "../config";
import { StreamContextSharedBuffer } from "./StreamContextSharedBuffer";
import { AceStreamClient } from "./types";

class StreamContext {
    onClosed: (() => void) | undefined;

    private readonly streamConfig: StreamConfig;
    private readonly source: AceStreamSource;
    private readonly logger: Logger;
    private readonly aceClient: AceClient;
    private readonly clients: Set<AceStreamClient>;
    private readonly sharedBuffer: StreamContextSharedBuffer;
    private readonly idleTimer: Timer;
    private info: AceStreamInfo;
    private response$: Promise<Response> | null;

    constructor(
        streamConfig: StreamConfig,
        source: AceStreamSource,
        info: AceStreamInfo,
        alias: string,
        aceClient: AceClient,
    ) {
        this.streamConfig = streamConfig;
        this.source = source;
        this.info = info;
        this.logger = createLogger(c => c`{green Stream > ${alias}}`);
        this.aceClient = aceClient;
        this.clients = new Set();
        this.sharedBuffer = new StreamContextSharedBuffer(streamConfig.sharedBufferLength);
        this.response$ = null;

        this.idleTimer = new Timer(streamConfig.responseTimeout, () => {
            this.logger.debug(`response > idle timeout`);
            this.closeSelf();
        });
    }

    open(): void {
        if (this.response$) {
            return;
        }

        this.logger.debug(`open`);
        this.response$ = this.init();
    }

    async close(): Promise<void> {
        if (!this.response$) {
            return;
        }

        this.logger.debug(`close`);
        this.response$ = null;
        this.idleTimer.stop();
        this.endAllRequests();

        await this.aceClient.stopStream(this.info);
    }

    async addClient(): Promise<AceStreamClient> {
        if (!this.response$) {
            throw new Error("Can't create a request for a non-open stream.");
        }

        const response = await this.response$;

        const stream = new PassThrough();

        const client: AceStreamClient = {
            stream,
            responseHeaders: response.headers,
        };

        stream.on("close", () => {
            this.removeClient(client);
        });

        stream.on("finish", () => {
            this.removeClient(client);
        });

        for (const chunk of this.sharedBuffer.chunks) {
            stream.write(chunk);
        }

        this.clients.add(client);

        return client;
    }

    removeClient(client: AceStreamClient): void {
        if (!this.clients.has(client)) {
            return;
        }

        this.clients.delete(client);

        if (this.clients.size === 0) {
            this.scheduleClose();
        }
    }

    updateInfo(info: AceStreamInfo): void {
        this.info = info;
    }

    private async init(): Promise<Response> {
        let response;

        try {
            response = await this.requestStream();
        }
        catch (err) {
            if (err instanceof GatewayError) {
                this.closeSelf();
            }
            throw err;
        }

        this.idleTimer.start();

        response.body.on("data", chunk => {
            this.idleTimer.reset();

            for (const r of this.clients) {
                try {
                    r.stream.write(chunk);
                }
                catch (err) {
                    this.logger.silly(`response > stream write > ${err}`);
                    this.removeClient(r);
                }
            }

            this.sharedBuffer.write(chunk);
        });

        response.body.on("error", (err) => {
            this.logger.warn(`response > error`, [err.message]);
        });

        response.body.on("close", () => {
            if (!this.response$) {
                return;
            }

            this.logger.debug(`response > closed`);
            this.closeSelf();
        });

        response.body.on("finish", () => {
            if (!this.response$) {
                return;
            }

            this.logger.debug(`response > finished`);
            this.closeSelf();
        });

        return response;
    }

    private endAllRequests(): void {
        const requests = Array.from(this.clients.values());
        this.clients.clear();

        for (const r of requests) {
            r.stream.end();
        }
    }

    private async requestStream(): Promise<Response> {
        this.logger.debug(c => c`{cyan ace engine} request content ..`);
        try {
            const streamInfo = await stopWatch(() => {
                return this.aceClient.getStream(this.info);
            });

            const { result: response, time, timeText } = streamInfo;

            this.logger.debug(c => c`{cyan ace engine} request content > success`, c => [
                c`request time: {bold ${timeText}}`,
            ]);

            return response;
        }
        catch (err) {
            this.logger.warn(c => c`{cyan ace engine} request content > failed`, c => [
                c`error: {bold ${err.toString()}}`,
            ]);

            throw err;
        }
    }

    private scheduleClose(): void {
        this.logger.debug(`schedule close`);

        global.setTimeout(
            () => {
                if (!this.response$) {
                    return;
                }

                if (this.clients.size !== 0) {
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
}

export { StreamContext }
