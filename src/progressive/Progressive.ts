import * as Hapi from "hapi";
import { logger, createSeqIdGenerator } from "../base";
import { ProgressiveConfig } from "../config";
import { Streaming } from "../streaming";
import { Channel } from "../types";
import { ProgressiveClient } from "./ProgressiveClient";

const generateClientId = createSeqIdGenerator();

class Progressive {
    private readonly config: ProgressiveConfig;
    private readonly streaming: Streaming;

    constructor(
        config: ProgressiveConfig,
        streaming: Streaming,
    ) {
        this.config = config;
        this.streaming = streaming;
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
    ): Promise<Hapi.ResponseObject | symbol> {
        try {
            const streamContext = await this.streaming.getContext(channel);
            const streamRequest = streamContext.createRequest();

            const client = new ProgressiveClient(
                request,
                h,
                this.config,
                streamRequest,
                generateClientId().toString(),
                channel.name,
            );

            return client.response$;
        }
        catch (err) {
            logger.error(err.stack);
            return h.response().code(500);
        }
    }
}

export { Progressive }
