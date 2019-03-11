import * as Hapi from "hapi";
import { Headers } from "node-fetch";
import { createLogger, Logger, Timer } from "../base";
import { ProgressiveConfig } from "../config";
import { ProgressiveClientBuffer } from "./ProgressiveClientBuffer";
import { StreamRequest } from "../streaming";

class ProgressiveClient {
    response$: Promise<Hapi.ResponseObject | symbol>;

    private readonly request: Hapi.Request;
    private readonly h: Hapi.ResponseToolkit;
    private readonly config: ProgressiveConfig;
    private readonly streamRequest: StreamRequest;
    private readonly logger: Logger;
    private readonly buffer: ProgressiveClientBuffer;
    private readonly idleTimer: Timer;
    private active: boolean
    private flushed: boolean;

    constructor(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        config: ProgressiveConfig,
        streamRequest: StreamRequest,
        clientAlias: string,
        streamAlias: string,
    ) {
        this.request = request;
        this.h = h;
        this.config = config;
        this.streamRequest = streamRequest;
        this.logger = createLogger(c => c`{magenta Progressive > ${streamAlias} > client ${clientAlias}}`);

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
                this.logger.debug(`idle timeout`);
                this.request.raw.res.destroy();
            },
        );

        if (!this.request.active()) {
            this.close();
            this.response$ = Promise.resolve(this.h.close);
            return;
        }

        this.logger.debug(`init`);

        this.request.raw.res.on("error", (err) => {
            this.logger.debug(`response error`, [
                c => c`{white ${err.message}}`,
            ]);
        });

        this.request.raw.res.on("close", () => {
            this.logger.debug(`response closed`);
            this.close();
        });

        this.request.raw.res.on("finish", () => {
            this.logger.debug(`response finished`);
            this.close();
        });

        this.request.raw.req.on("error", (err) => {
            this.logger.debug(`request error`, [
                c => c`{white ${err.message}}`,
            ]);
        });

        this.request.raw.req.on("close", () => {
            this.logger.debug(`request closed`);
            this.close();
        });

        this.response$ = this.streamRequest.response$.then(response => {
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

            this.streamRequest.stream.on("data", chunk => {
                if (this.active && this.flushed && this.buffer.isEmpty) {
                    this.writeResponse(chunk);
                }
                else {
                    this.buffer.push(chunk);
                }
            });

            this.streamRequest.stream.on("close", () => {
                this.close();
            });

            this.streamRequest.stream.on("finish", () => {
                this.close();
            });

            return this.h.abandon;
        });
    }

    private close(): void {
        this.logger.debug(`close`);
        this.idleTimer.stop();
        this.request.raw.res.destroy();
        this.streamRequest.stream.end();
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
