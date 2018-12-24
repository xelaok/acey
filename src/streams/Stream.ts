import * as Hapi from "hapi";
import { Response, FetchError } from "node-fetch";
import { logger, createSeqIdGenerator, forget, stopWatch } from "../base";
import * as aceApi from "../ace-api";
import { StreamConfig, AceEngineConfig } from "../config";
import { Client } from "./Client";
import { StreamSharedBuffer } from "./StreamSharedBuffer";

class Stream {
    response$: Promise<Response | null>;
    onStopped: (() => void) | null;

    private streamConfig: StreamConfig;
    private aceEngineConfig: AceEngineConfig;
    private source: aceApi.StreamSource;
    private info: aceApi.StreamInfo;
    private alias: string;
    private clients: Set<Client> = new Set();
    private clientIdGenerator = createSeqIdGenerator();
    private sharedBuffer: StreamSharedBuffer;
    private isStopScheduled: boolean = false;

    constructor(
        streamConfig: StreamConfig,
        aceEngineConfig: AceEngineConfig,
        source: aceApi.StreamSource,
        info: aceApi.StreamInfo,
        alias: string,
    ) {
        this.streamConfig = streamConfig;
        this.aceEngineConfig = aceEngineConfig;
        this.source = source;
        this.info = info;
        this.alias = alias;
        this.sharedBuffer = new StreamSharedBuffer(streamConfig.sharedBufferLength);
    }

    start(): void {
        this.response$ = this.requestStream();

        this.response$.then(response => {
            if (!response || response.status !== 200) {
                return null;
            }

            response.body.on("data", chunk => {
                for (const client of this.clients) {
                    client.write(chunk);
                }

                this.sharedBuffer.write(chunk);
            });

            response.body.on("error", (err) => {
                logger.debug(`${this.alias} > response > error`);
                logger.warn(`- ${err.message}`);
            });

            response.body.once("close", () => {
                logger.debug(`${this.alias} > response > closed`);
                this.closeAllClients();
            });

            response.body.once("finish", () => {
                logger.debug(`${this.alias} > response > finished`);
                this.closeAllClients();
            });
        });
    }

    async dispose(): Promise<void> {
        await this.stopStream();
    }

    handleClientRequest(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject | symbol> {
        const client = new Client(
            request,
            h,
            this.streamConfig,
            this.response$,
            this.clientIdGenerator().toString(),
            this.alias,
        );

        for (const chunk of this.sharedBuffer.chunks) {
            client.write(chunk);
        }

        this.addClient(client);

        client.handle();
        client.onClosed = () => this.removeClient(client);

        return client.response$;
    }

    updateInfo(info: aceApi.StreamInfo): void {
        this.info = info;
    }

    private addClient(client: Client): void {
        this.clients.add(client);
    }

    private removeClient(client: Client): void {
        this.clients.delete(client);

        if (this.clients.size === 0) {
            this.scheduleStopStream(this.streamConfig.stopDelay);
        }
    }

    private closeAllClients(): void {
        const clients = Array.from(this.clients.values());
        clients.forEach(c => c.close());
    }

    private async requestStream(): Promise<Response | null> {
        logger.debug(`${this.alias} > content ..`);
        try {
            const requestInit = {
                timeout: this.streamConfig.requestTimeout,
            };

            const { timeText, result: response } = await stopWatch(() => {
                return aceApi.getStreamByInfo(this.aceEngineConfig.path, this.info, requestInit);
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
                if (this.clients.size !== 0) {
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
            return aceApi.stopStreamByInfo(this.aceEngineConfig.path, this.info);
        });

        logger.debug(`${this.alias} > stop > response`);
        logger.debug(`- status: ${response.status} (${response.statusText})`);
        logger.debug(`- request time: ${timeText}`);
    }
}

export { Stream }
