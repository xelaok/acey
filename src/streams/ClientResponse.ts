import { OutgoingHttpHeaders } from "http";
import * as Hapi from "hapi";
import { Response, Headers } from "node-fetch";
import { logger, Timer } from "../base";
import { StreamConfig } from "../config";
import { ClientBuffer } from "./ClientBuffer";

class ClientResponse {
    result$: Promise<Hapi.ResponseObject | symbol>;
    onClosed: (() => void) | null;

    private request: Hapi.Request;
    private h: Hapi.ResponseToolkit;
    private streamConfig: StreamConfig;
    private streamResponse$: Promise<Response | null>;
    private alias: string;
    private streamAlias: string;
    private buffer: ClientBuffer;
    private idleTimer: Timer;
    private active: boolean
    private flushed: boolean;

    constructor(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        streamConfig: StreamConfig,
        streamResponse$: Promise<Response | null>,
        alias: string,
        streamAlias: string,
    ) {
        this.request = request;
        this.h = h;
        this.streamConfig = streamConfig;
        this.streamResponse$ = streamResponse$;
        this.alias = alias;
        this.streamAlias = streamAlias;

        this.active = false;
        this.flushed = true;

        this.buffer = new ClientBuffer(
            streamConfig.clientMaxBufferLength,
            streamConfig.clientResetBufferLength,
            alias,
            streamAlias,
        );

        this.idleTimer = new Timer(
            this.streamConfig.clientIdleTimeout,
            () => {
                logger.debug(`${this.streamAlias} > client ${this.alias} > idle timeout`);
                this.request.raw.res.destroy();
            },
        );
    }

    handle(): void {
        logger.debug(`${this.streamAlias} > client ${this.alias} > init`);

        this.request.raw.res.on("error", (err) => {
            logger.debug(`${this.streamAlias} > client ${this.alias} > response error`);
            logger.debug(`- ${err.message}`);
        });

        this.request.raw.res.once("close", () => {
            logger.debug(`${this.streamAlias} > client ${this.alias} > response closed`);
            this.close();
            this.handleClosed();
        });

        this.request.raw.res.once("finish", () => {
            logger.debug(`${this.streamAlias} > client ${this.alias} > response finished`);
            this.close();
            this.handleClosed();
        });

        this.request.raw.req.on("error", (err) => {
            logger.debug(`${this.streamAlias} > client ${this.alias} > request error`);
            logger.debug(`- ${err.message}`);
        });

        this.request.raw.req.once("close", () => {
            logger.debug(`${this.streamAlias} > client ${this.alias} > request closed`);
            this.close();
            this.handleClosed();
        });

        this.result$ = this.streamResponse$.then(streamResponse => {
            if (!streamResponse) {
                return this.h.response().code(502);
            }

            this.active = true;
            this.idleTimer.start();

            this.writeHeaders(streamResponse.headers);
            this.handleWriteOnDrain();

            return this.h.abandon;
        });
    }

    close(): void {
        this.idleTimer.stop();
        this.request.raw.res.destroy();
    }

    write(chunk: Buffer): void {
        if (this.active && this.flushed && this.buffer.isEmpty) {
            this.writeResponse(chunk);
        }
        else {
            this.buffer.push(chunk);
        }
    }

    private writeHeaders(streamResponseHeaders: Headers): void {
        const headers: OutgoingHttpHeaders =
            this.streamConfig.chunkedTransferEncoding
                ?
                {
                    "connection": "keep-alive",
                    "content-type": streamResponseHeaders.get("content-type") as string,
                    "transfer-encoding": "chunked",
                }
                :
                {
                    "connection": "close",
                    "content-type": streamResponseHeaders.get("content-type") as string,
                }
            ;

        this.request.raw.res.writeHead(200, headers);
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

    private handleClosed(): void {
        this.onClosed && this.onClosed();
    }
}

export { ClientResponse }
