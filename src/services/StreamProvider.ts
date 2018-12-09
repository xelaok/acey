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
    private items: Map<string, StreamItem> = new Map();

    constructor(options: StreamProviderOptions, iproxyPath: string) {
        this.options = options;
        this.iproxyPath = iproxyPath;
    }

    async request(cid: string, name: string, h: Hapi.ResponseToolkit): Promise<Hapi.ResponseObject> {
        try {
            const rid = shortid();

            logger.debug(`StreamProvider > request ("${name}", rid: ${rid})`);

            let item = this.items.get(cid);

            if (!item) {
                item = this.startStream(cid, name);
                this.items.set(cid, item);
            }

            const stream = new Stream.PassThrough();
            const client = { rid, stream };

            item.clients.add(client);

            stream.once("close", () => {
                logger.debug(`StreamProvider > client stream > close ("${name}", rid: ${rid})`);
                idleTimoutTimer.stop();
                this.rejectClient(cid, name, client);
            });

            stream.once("finish", () => {
                logger.debug(`StreamProvider > client stream > finish ("${name}", rid: ${rid})`);
            });

            const idleTimoutTimer = new Timer(
                this.options.clientIdleTimeout * 1000,
                () => stream.end(),
            );

            idleTimoutTimer.start();

            const response = await item.responsePromise;
            const clientResponse = h.response(stream);

            for (const [name, value] of response.headers) {
                clientResponse.header(name, value);
            }

            clientResponse.events.on("peek", () => {
                idleTimoutTimer.reset();
            });

            clientResponse.events.on("finish", () => {
                logger.debug(`StreamProvider > client response > finish ("${name}", rid: ${rid})`);
            });

            return clientResponse;
        }
        catch (err) {
            logger.error(err.stack);
            return h.response().code(500);
        }
    }

    private rejectClient(cid: string, name: string, client: StreamClient): void {
        logger.debug(`StreamProvider > reject client ("${name}", rid: ${client.rid})`);

        const item = this.items.get(cid);

        if (!item) {
            return;
        }

        item.clients.delete(client);

        if (item.clients.size !== 0) {
            return;
        }

        this.items.delete(cid);
        this.stopStream(item, name);
    }

    private startStream(cid: string, name: string): StreamItem {
        logger.debug(`StreamProvider > start stream ("${name}")`);

        const sid = nanoid();
        const requestInit = {
            timeout: this.options.requestTimeout * 1000,
        };
        const clients = new Set<StreamClient>();
        const responsePromise = aceApi.getStream(this.iproxyPath, cid, sid, requestInit);

        responsePromise
            .then((response) => {
                logger.debug(`StreamProvider > start stream > response ok ("${name}", status: ${response.status} - ${response.statusText})`);

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
                    logger.debug(`StreamProvider > stream response > close ("${name}")`);
                });

                response.body.on("finish", () => {
                    logger.debug(`StreamProvider > stream response > finish ("${name}")`);
                });
            })
            .catch(err => {
                logger.debug(`StreamProvider > start stream > response failed ("${name}")`);
                return Promise.reject(err);
            });

        return {
            cid,
            sid,
            clients,
            responsePromise,
        };
    }

    private stopStream(item: StreamItem, name: string): void {
        logger.debug(`StreamProvider > stop stream ("${name}")`);
        fireAndForget(() => aceApi.stopStream(this.iproxyPath, item.cid, item.sid));
    }
}

export { StreamProvider, StreamProviderOptions }
