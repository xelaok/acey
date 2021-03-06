import * as Hapi from "hapi";
import { Headers } from "node-fetch";
import { createLogger, Logger, Timer } from "../base";
import { ProgressiveConfig } from "../config";
import { ClientBuffer } from "./ClientBuffer";
import { StreamService, StreamContext, StreamClient } from "../stream";
import { Channel } from "../types";

class Client {
    private readonly request: Hapi.Request;
    private readonly h: Hapi.ResponseToolkit;
    private readonly config: ProgressiveConfig;
    private readonly channel: Channel;
    private readonly streamService: StreamService;
    private readonly logger: Logger;
    private readonly buffer: ClientBuffer;
    private readonly idleTimer: Timer;
    private active: boolean
    private flushed: boolean;
    private streamContext: StreamContext | undefined;
    private streamClient: StreamClient | undefined;

    constructor(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        config: ProgressiveConfig,
        channel: Channel,
        streamService: StreamService,
        clientAlias: string,
    ) {
        this.request = request;
        this.h = h;
        this.config = config;
        this.channel = channel;
        this.streamService = streamService;
        this.logger = createLogger(c => c`{magenta Progressive > ${channel.name} > client ${clientAlias}}`);
        this.active = false;
        this.flushed = true;

        this.buffer = new ClientBuffer(
            config.clientMaxBufferLength,
            config.clientResetBufferLength,
            clientAlias,
            channel.name,
        );

        this.idleTimer = new Timer(
            this.config.clientIdleTimeout,
            () => {
                this.logger.debug(`idle timeout`);
                this.request.raw.res.destroy();
            },
        );

        this.request.raw.res.on("error", (err) => {
            this.logger.debug(`response error`, c => [
                c`{white ${err.message}}`,
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
            this.logger.debug(`request error`, c => [
                c`{white ${err.message}}`,
            ]);
        });

        this.request.raw.req.on("close", () => {
            this.logger.debug(`request closed`);
            this.close();
        });
    }

    async init(): Promise<Hapi.ResponseObject | symbol> {
        this.logger.verbose("init");

        const streamContext = await this.streamService.getContext(this.channel);
        const streamClient = await streamContext.createClient();

        if (!this.request.active()) {
            streamContext.deleteClient(streamClient);
            return this.h.close;
        }

        streamClient.stream.on("data", chunk => {
            if (this.active && this.flushed && this.buffer.isEmpty) {
                this.writeResponse(chunk);
            }
            else {
                this.buffer.push(chunk);
            }
        });

        streamClient.stream.on("close", () => {
            this.close();
        });

        streamClient.stream.on("finish", () => {
            this.close();
        });

        this.active = true;
        this.streamContext = streamContext;
        this.streamClient = streamClient;
        this.idleTimer.start();
        this.writeHeaders(streamClient.responseHeaders);
        this.handleWriteOnDrain();

        return this.h.abandon;
    }

    private close(): void {
        if (!this.active) {
            return;
        }

        this.logger.verbose(`close`);

        this.active = false;
        this.idleTimer.stop();
        this.request.raw.res.destroy();

        if (this.streamContext && this.streamClient) {
            this.streamContext.deleteClient(this.streamClient);
        }
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

export { Client }
