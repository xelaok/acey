import * as Hapi from "hapi";
import { logger, createSeqIdGenerator } from "../base";
import { ProgressiveConfig } from "../config";
import { StreamService } from "../stream";
import { Channel } from "../types";
import { Client } from "./Client";

const generateClientId = createSeqIdGenerator();

class ProgressiveService {
    private readonly config: ProgressiveConfig;
    private readonly streamService: StreamService;

    constructor(
        config: ProgressiveConfig,
        streamService: StreamService,
    ) {
        this.config = config;
        this.streamService = streamService;
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
    ): Promise<Hapi.ResponseObject | symbol> {
        const client = new Client(
            request,
            h,
            this.config,
            channel,
            this.streamService,
            generateClientId().toString(),
        );

        return client.init();
    }
}

export { ProgressiveService }
