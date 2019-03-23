import { createLogger, handleWithRetry, Logger } from "../base";
import { StreamConfig } from "../config";
import { AceClient, AceStreamSource } from "../ace-client";
import { Channel, ChannelSourceType, AceChannel } from "../types";
import { StreamContext } from "./StreamContext";

class StreamService {
    private readonly config: StreamConfig;
    private readonly aceClient: AceClient;
    private readonly logger: Logger;
    private readonly contextsBySource: Map<string, StreamContext>;
    private readonly contextsByInfohash: Map<string, StreamContext>;

    constructor(config: StreamConfig, aceClient: AceClient) {
        this.config = config;
        this.aceClient = aceClient;
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
            case ChannelSourceType.Ace:
                return Promise.resolve((channel as AceChannel).streamSource);
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
