import * as Hapi from "hapi";
import { Headers } from "node-fetch";
import { logger, Timer } from "../base";
import { ProgressiveDownloadConfig } from "../config";
import { ProgressiveClientBuffer } from "./ProgressiveClientBuffer";
import { StreamRequestResult } from "../streaming";

class ProgressiveClient {
    response$: Promise<Hapi.ResponseObject | symbol>;

    private readonly request: Hapi.Request;
    private readonly h: Hapi.ResponseToolkit;
    private readonly config: ProgressiveDownloadConfig;
    private readonly requestResult: StreamRequestResult;
    private readonly clientAlias: string;
    private readonly streamAlias: string;
    private readonly buffer: ProgressiveClientBuffer;
    private readonly idleTimer: Timer;
    private active: boolean
    private flushed: boolean;

    constructor(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        config: ProgressiveDownloadConfig,
        requestResult: StreamRequestResult,
        clientAlias: string,
        streamAlias: string,
    ) {
        this.request = request;
        this.h = h;
        this.config = config;
        this.requestResult = requestResult;
        this.clientAlias = clientAlias;
        this.streamAlias = streamAlias;

        this.active = false;
        this.flushed = true;

        this.buffer = new ProgressiveClientBuffer(
            config.clientMaxBufferLength,
            config.clientResetBufferLength,
            clientAlias,
            streamAlias,
        );

        this.idleTimer = new Timer(
            this.config.clientIdleTimeout,
            () => {
                logger.debug(`${this.streamAlias} > client ${this.clientAlias} > idle timeout`);
                this.request.raw.res.destroy();
            },
        );

        if (!this.request.active()) {
            this.close();
            this.response$ = Promise.resolve(this.h.close);
            return;
        }

        logger.debug(`${this.streamAlias} > client ${this.clientAlias} > init`);

        this.request.raw.res.on("error", (err) => {
            logger.debug(`${this.streamAlias} > client ${this.clientAlias} > response error`);
            logger.debug(`- ${err.message}`);
        });

        this.request.raw.res.once("close", () => {
            logger.debug(`${this.streamAlias} > client ${this.clientAlias} > response closed`);
            this.close();
        });

        this.request.raw.res.once("finish", () => {
            logger.debug(`${this.streamAlias} > client ${this.clientAlias} > response finished`);
            this.close();
        });

        this.request.raw.req.on("error", (err) => {
            logger.debug(`${this.streamAlias} > client ${this.clientAlias} > request error`);
            logger.debug(`- ${err.message}`);
        });

        this.request.raw.req.once("close", () => {
            logger.debug(`${this.streamAlias} > client ${this.clientAlias} > request closed`);
            this.close();
        });

        this.response$ = this.requestResult.response$.then(response => {
            if (!this.request.active()) {
                return this.h.close;
            }

            if (!response || response.status !== 200) {
                return this.h.response().code(502);
            }

            this.active = true;
            this.idleTimer.start();

            this.writeHeaders(response.headers);
            this.handleWriteOnDrain();

            this.requestResult.stream.on("data", chunk => {
                if (this.active && this.flushed && this.buffer.isEmpty) {
                    this.writeResponse(chunk);
                }
                else {
                    this.buffer.push(chunk);
                }
            });

            this.requestResult.stream.on("close", () => {
                this.close();
            });

            this.requestResult.stream.on("finish", () => {
                this.close();
            });

            return this.h.abandon;
        });
    }

    private close(): void {
        this.idleTimer.stop();
        this.request.raw.res.destroy();
        this.requestResult.stream.end();
    }

    private writeHeaders(streamResponseHeaders: Headers): void {
        ["Content-Type", "Accept-Ranges"].forEach(header => {
           this.request.raw.res.setHeader(header, streamResponseHeaders.get(header) as string);
        });
    }

    private handleWriteOnDrain(): void {
        while (this.flushed) {
            const chunk = this.buffer.pull();

            if (!chunk) {
                break;
            }

            this.writeResponse(chunk);
        }

        this.request.raw.res.once("drain", () => {
            this.flushed = true;
            this.idleTimer.reset();

            this.handleWriteOnDrain();
        });
    }

    private writeResponse(chunk: Buffer): void {
        this.flushed = this.request.raw.res.write(chunk);

        if (this.flushed) {
            this.idleTimer.reset();
        }
    }
}

export { ProgressiveClient }
