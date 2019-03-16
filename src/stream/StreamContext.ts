import { PassThrough } from "stream";
import { Response } from "node-fetch";
import { createLogger, forget, handleWithRetry, stopWatch, Logger, Timer, GatewayError } from "../base";
import { AceClient, AceStreamSource, AceStream } from "../ace-client";
import { StreamConfig } from "../config";
import { StreamContextSharedBuffer } from "./StreamContextSharedBuffer";
import { StreamClient } from "./types";

class StreamContext {
    onClosed: (() => void) | undefined;

    private readonly streamConfig: StreamConfig;
    private readonly stream: AceStream;
    private readonly alias: string;
    private readonly aceClient: AceClient;
    private readonly logger: Logger;
    private readonly clients: Set<StreamClient>;
    private readonly sharedBuffer: StreamContextSharedBuffer;
    private readonly idleTimer: Timer;
    private response$: Promise<Response> | null;

    constructor(
        streamConfig: StreamConfig,
        stream: AceStream,
        alias: string,
        aceClient: AceClient,
    ) {
        this.streamConfig = streamConfig;
        this.stream = stream;
        this.alias = alias;
        this.aceClient = aceClient;
        this.logger = createLogger(c => c`{green Stream > ${alias}}`);
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

        await this.aceClient.requestStopStream(this.stream, this.alias);
    }

    async createClient(): Promise<StreamClient> {
        if (!this.response$) {
            throw new Error("Can't create a request for a non-open stream.");
        }

        const response = await this.response$;

        const stream = new PassThrough();

        const client: StreamClient = {
            stream,
            responseHeaders: response.headers,
        };

        stream.on("close", () => {
            this.deleteClient(client);
        });

        stream.on("finish", () => {
            this.deleteClient(client);
        });

        for (const chunk of this.sharedBuffer.chunks) {
            stream.write(chunk);
        }

        this.clients.add(client);

        return client;
    }

    deleteClient(client: StreamClient): void {
        if (!this.clients.has(client)) {
            return;
        }

        this.clients.delete(client);

        if (this.clients.size === 0) {
            this.scheduleClose();
        }
    }

    private async init(): Promise<Response> {
        let response;

        try {
            response = await this.aceClient.requestStreamContent(this.stream, this.alias);
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
                    this.deleteClient(r);
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
