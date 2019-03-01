import * as Hapi from "hapi";
import { logger, createSeqIdGenerator } from "../base";
import { ProgressiveDownloadConfig } from "../config";
import { Streaming } from "../streaming";
import { Channel } from "../types";
import { ProgressiveClient } from "./ProgressiveClient";

const generateClientId = createSeqIdGenerator();

class Progressive {
    private readonly progressiveDownloadConfig: ProgressiveDownloadConfig;
    private readonly streaming: Streaming;

    constructor(
        progressiveDownloadConfig: ProgressiveDownloadConfig,
        streaming: Streaming,
    ) {
        this.progressiveDownloadConfig = progressiveDownloadConfig;
        this.streaming = streaming;
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
    ): Promise<Hapi.ResponseObject | symbol> {
        try {
            const requestResult = await this.streaming.requestChannel(channel);

            const client = new ProgressiveClient(
                request,
                h,
                this.progressiveDownloadConfig,
                requestResult,
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
