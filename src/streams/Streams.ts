import * as Hapi from "hapi";
import { logger } from "../base";
import { StreamConfig, AceEngineConfig } from "../config";
import * as aceApi from "../ace-api";
import { StreamPool } from "./StreamPool";

class Streams {
    private streamConfig: StreamConfig;
    private streamPool: StreamPool;

    constructor(streamConfig: StreamConfig, aceEngineConfig: AceEngineConfig) {
        this.streamConfig = streamConfig;
        this.streamPool = new StreamPool(streamConfig, aceEngineConfig);
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        source: aceApi.StreamSource,
        alias: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        try {
            const stream = await this.streamPool.resolve(source, alias);
            const response = await stream.handleClientRequest(request, h);

            return response;
        }
        catch (err) {
            logger.error(err.stack);
            return h.response().code(500);
        }
    }

    async dispose(): Promise<void> {
        await this.streamPool.dispose();
    }
}

export { Streams }
