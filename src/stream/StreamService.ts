import nanoid from "nanoid";
import { createLogger, stopWatch, Logger } from "../base";
import { StreamConfig } from "../config";
import { AceClient, AceStreamSource, AceStreamInfo } from "../ace-client";
import { TtvClient } from "../ttv-client";
import { Channel, ChannelSource, AceChannel } from "../types";
import { StreamContext } from "./StreamContext";
import { AceStreamClient } from "./types";

class StreamService {
    private readonly config: StreamConfig;
    private readonly aceClient: AceClient;
    private readonly ttvClient: TtvClient;
    private readonly logger: Logger;
    private readonly contextsBySource: Map<string, StreamContext>;
    private readonly contextsByPlaybackId: Map<string, StreamContext>;

    constructor(config: StreamConfig, aceClient: AceClient, ttvClient: TtvClient) {
        this.config = config;
        this.aceClient = aceClient;
        this.ttvClient = ttvClient;
        this.logger = createLogger(c => c`{green Stream}`);
        this.contextsBySource = new Map();
        this.contextsByPlaybackId = new Map();
    }

    async addClient(channel: Channel): Promise<AceStreamClient> {
        const source = await this.resolveSource(channel);
        const context = await this.resolveContext(source, channel.name);
        const client = await context.addClient();

        return client;
    }

    closeClient(client: AceStreamClient): void {
        client.stream.end();
    }

    async close(): Promise<void> {
        const streams = Array.from(this.contextsBySource.values());
        await Promise.all(streams.map(s => s.close()));
    }

    private async resolveSource(channel: Channel): Promise<AceStreamSource> {
        switch (channel.source) {
            case ChannelSource.Ace:
                return (channel as AceChannel).streamSource;

            case ChannelSource.Ttv:
                return await this.ttvClient.getAceStreamSource(channel.id);

            default:
                throw new Error(`Unknown channel source: ${channel.source}`);
        }
    }

    private async resolveContext(source: AceStreamSource, alias: string): Promise<StreamContext> {
        let context = this.contextsBySource.get(source.value);

        if (context) {
            return context;
        }

        const info = await this.getStreamInfo(source, alias);
        context = this.contextsByPlaybackId.get(info.playbackId);

        if (context) {
            context.updateInfo(info);
            return context;
        }

        context = new StreamContext(
            this.config,
            source,
            info,
            alias,
            this.aceClient,
        );

        this.contextsBySource.set(source.value, context);
        this.contextsByPlaybackId.set(info.playbackId, context);

        context.onClosed = () => {
            this.logger.debug(c => c`remove {bold ${alias}}`);
            this.contextsBySource.delete(source.value);
            this.contextsByPlaybackId.delete(info.playbackId);
        };

        context.open();

        return context;
    }

    private async getStreamInfo(source: AceStreamSource, alias: string): Promise<AceStreamInfo> {
        this.logger.debug(c => c`{cyan ace engine} > request info for {bold ${alias}} ..`);

        try {
            const { timeText, result } = await stopWatch(() => {
                return this.aceClient.getStreamInfo(source, nanoid());
            });

            this.logger.debug(c => c`{cyan ace engine} > request info for {bold ${alias}} > response`, c => [
                c`request time: {bold ${timeText}}`
            ]);

            return result;
        }
        catch (err) {
            this.logger.warn(
                c => c`{cyan ace engine} > request info for {bold ${alias}} > failed`,
                [`error: ${err}`],
            );
            throw err;
        }
    }
}

export { StreamService }
