import Stream from "stream";
import * as Hapi from "hapi";
import { Response } from "node-fetch";
import nanoid from "nanoid";
import shortid from "shortid";
import { logger } from "../libs/logger";
import * as aceApi from "../libs/ace-api";
import { fireAndForget } from "../libs/misc/fireAndForget";
import { Timer } from "../libs/misc/Timer";
import { StreamProviderOptions } from "../types";

type StreamItem = {
    cid: string,
    sid: string,
    alias: string,
    clients: Set<StreamClient>,
    responsePromise: Promise<Response>,
};

type StreamClient = {
    rid: string,
    stream: Stream.PassThrough,
};

class StreamProvider {
    private readonly options: StreamProviderOptions;
    private readonly iproxyPath: string;
    private streams: Map<string, StreamItem> = new Map();

    constructor(options: StreamProviderOptions, iproxyPath: string) {
        this.options = options;
        this.iproxyPath = iproxyPath;
    }

    async request(
        cid: string,
        alias: string,
        request: Hapi.Request,
        h: Hapi.ResponseToolkit
    ): Promise<Hapi.ResponseObject> {
        try {
            const rid = shortid();

            logger.debug(`StreamProvider > request ("${alias}", rid: ${rid})`);

            let stream = this.streams.get(cid);

            if (!stream) {
                stream = this.startStream(cid, alias);
                this.streams.set(cid, stream);
            }

            const clientStream = new Stream.PassThrough();
            const clientResponse = h.response(clientStream);

            const client = {
                rid,
                stream: clientStream,
            };

            stream.clients.add(client);

            const idleTimoutTimer = new Timer(
                this.options.clientIdleTimeout * 1000,
                () => {
                    logger.debug(`StreamProvider > client > idle timeout ("${alias}", rid: ${rid})`);
                    clientStream.end();
                },
            );

            request.events.once("finish", () => {
                logger.debug(`StreamProvider > request > finish ("${alias}", rid: ${rid})`);
            });

            request.events.once("disconnect", () => {
                logger.debug(`StreamProvider > request > disconnect ("${alias}", rid: ${rid})`);
            });

            clientStream.once("close", () => {
                logger.debug(`StreamProvider > client > stream > close ("${alias}", rid: ${rid})`);
                idleTimoutTimer.stop();
                this.rejectClient(stream, client);
            });

            clientStream.once("finish", () => {
                logger.debug(`StreamProvider > client > stream > finish ("${alias}", rid: ${rid})`);
            });

            clientResponse.events.on("peek", (chunk) => {
                idleTimoutTimer.reset();
            });

            clientResponse.events.once("finish", () => {
                logger.debug(`StreamProvider > client > response > finish ("${alias}", rid: ${rid})`);
            });

            idleTimoutTimer.start();

            const response = await stream.responsePromise;

            for (const [name, value] of response.headers) {
                clientResponse.header(name, value);
            }

            return clientResponse;
        }
        catch (err) {
            logger.error(err.stack);
            return h.response().code(500);
        }
    }

    release(): void {
        const streams = Array.from(this.streams.values());
        this.streams.clear();

        for (const s of streams) {
            this.stopStream(s);
        }
    }

    private rejectClient(stream: StreamItem, client: StreamClient): void {
        logger.debug(`StreamProvider > client > reject ("${stream.alias}", rid: ${client.rid})`);

        stream.clients.delete(client);

        if (!this.canReleaseStream(stream)) {
            return;
        }

        if (this.options.stopDelay > 0) {
            this.scheduleReleaseStream(stream);
        }
        else {
            this.releaseStream(stream);
        }
    }

    private scheduleReleaseStream(stream: StreamItem): void {
        logger.debug(`StreamProvider > stream > stop > schedule ("${stream.alias}")`);

        global.setTimeout(
            () => {
                if (!this.canReleaseStream(stream)) {
                    logger.debug(`StreamProvider > stream > stop > schedule > canceled ("${stream.alias}")`);
                    return;
                }

                this.releaseStream(stream);
            },
            this.options.stopDelay * 1000,
        );
    }

    private releaseStream(stream: StreamItem): void {
        this.streams.delete(stream.cid);
        this.stopStream(stream);
    }

    private canReleaseStream(stream: StreamItem): boolean {
        return stream.clients.size === 0;
    }

    private startStream(cid: string, alias: string): StreamItem {
        logger.debug(`StreamProvider > stream > start ("${alias}")`);

        const sid = nanoid();
        const requestInit = {
            timeout: this.options.requestTimeout * 1000,
        };
        const clients = new Set<StreamClient>();
        const responsePromise = aceApi.getStream(this.iproxyPath, cid, sid, requestInit);

        responsePromise
            .then((response) => {
                logger.debug(`StreamProvider > stream > start > got response ("${alias}", status: ${response.status} - ${response.statusText})`);

                if (response.status !== 200) {
                    for (const c of clients) {
                        c.stream.end();
                    }
                    return;
                }

                response.body.on("data", (chunk) => {
                    for (const c of clients) {
                        try {
                            c.stream.write(chunk);
                        }
                        catch (err) {
                            logger.warn(err.stack);
                        }
                    }
                });

                response.body.on("close", () => {
                    logger.debug(`StreamProvider > stream > response > close ("${alias}")`);
                });

                response.body.on("finish", () => {
                    logger.debug(`StreamProvider > stream > response > finish ("${alias}")`);
                });
            })
            .catch(err => {
                logger.debug(`StreamProvider > stream > start > response > failed ("${alias}")`);
                return Promise.reject(err);
            });

        return {
            cid,
            sid,
            alias,
            clients,
            responsePromise,
        };
    }

    private stopStream(stream: StreamItem): void {
        logger.debug(`StreamProvider > stream > stop ("${stream.alias}")`);
        fireAndForget(() => aceApi.stopStream(this.iproxyPath, stream.cid, stream.sid));
    }
}

export { StreamProvider, StreamProviderOptions }
