import { createLogger, handleWithRetry, Logger } from "../base";
import { StreamConfig } from "../config";
import { AceClient, AceStreamSource } from "../ace-client";
import { TtvClient } from "../ttv-client";
import { Channel, ChannelSource, AceChannel } from "../types";
import { StreamContext } from "./StreamContext";

class StreamService {
    private readonly config: StreamConfig;
    private readonly aceClient: AceClient;
    private readonly ttvClient: TtvClient;
    private readonly logger: Logger;
    private readonly contextsBySource: Map<string, StreamContext>;
    private readonly contextsByInfohash: Map<string, StreamContext>;

    constructor(config: StreamConfig, aceClient: AceClient, ttvClient: TtvClient) {
        this.config = config;
        this.aceClient = aceClient;
        this.ttvClient = ttvClient;
        this.logger = createLogger(c => c`{green Stream}`);
        this.contextsBySource = new Map();
        this.contextsByInfohash = new Map();
    }

    async getContext(channel: Channel): Promise<StreamContext> {
        const source = await this.resolveSource(channel);
        const context = await this.resolveContext(source, channel.name);

        return context;
    }

    async close(): Promise<void> {
        const streams = Array.from(this.contextsBySource.values());
        await Promise.all(streams.map(s => s.close()));
    }

    private resolveSource(channel: Channel): Promise<AceStreamSource> {
        switch (channel.source) {
            case ChannelSource.Ace:
                return Promise.resolve((channel as AceChannel).streamSource);

            case ChannelSource.Ttv:
                return handleWithRetry(
                    retryNum => {
                        if (retryNum > 0) {
                            this.logger.warn(c => c`ttv request retry {bold ${retryNum.toString()}}`);
                        }

                        return this.ttvClient.getAceStreamSource(channel.id);
                    },
                    500,
                    2,
                );

            default:
                throw new Error(`Unknown channel source: ${channel.source}`);
        }
    }

    private async resolveContext(source: AceStreamSource, alias: string): Promise<StreamContext> {
        let context = this.contextsBySource.get(source.value);

        if (context) {
            return context;
        }

        const stream = await this.aceClient.requestStream(source, alias);
        context = this.contextsByInfohash.get(stream.infohash);

        if (context) {
            return context;
        }

        context = new StreamContext(
            this.config,
            stream,
            alias,
            this.aceClient,
        );

        this.contextsBySource.set(source.value, context);
        this.contextsByInfohash.set(stream.infohash, context);

        context.onClosed = () => {
            this.logger.debug(c => c`remove {bold ${alias}}`);
            this.contextsBySource.delete(source.value);
            this.contextsByInfohash.delete(stream.infohash);
        };

        context.open();

        return context;
    }
}

export { StreamService }
