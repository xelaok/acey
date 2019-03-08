import nanoid from "nanoid";
import { logger, stopWatch } from "../base";
import { StreamConfig } from "../config";
import { AceApi, AceStreamSource, AceStreamInfo } from "../ace-api";
import { TtvApi } from "../ttv-api";
import { Channel, ChannelSource, AceChannel } from "../types";
import { StreamContext } from "./StreamContext";

class Streaming {
    private readonly config: StreamConfig;
    private readonly aceApi: AceApi;
    private readonly ttvApi: TtvApi;
    private readonly contextsBySource: Map<string, StreamContext> = new Map();
    private readonly contextsByPlaybackId: Map<string, StreamContext> = new Map();

    constructor(config: StreamConfig, aceApi: AceApi, ttvApi: TtvApi) {
        this.config = config;
        this.aceApi = aceApi;
        this.ttvApi = ttvApi;
    }

    async getContext(channel: Channel): Promise<StreamContext> {
        const source = await this.resolveSource(channel);
        return this.resolveContext(source, channel.name);
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
                return await this.ttvApi.getAceStreamSource(Number.parseInt(channel.id, 10));

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
            this.aceApi,
        );

        this.contextsBySource.set(source.value, context);
        this.contextsByPlaybackId.set(info.playbackId, context);

        context.onStopped = () => {
            this.contextsBySource.delete(source.value);
            this.contextsByPlaybackId.delete(info.playbackId);
        };

        context.open();

        return context;
    }

    private async getStreamInfo(
        source: AceStreamSource,
        alias: string,
    ): Promise<AceStreamInfo> {
        logger.debug(`Stream > ${alias} > info ..`);

        const { timeText, result } = await stopWatch(() => {
            return this.aceApi.getStreamInfo(source, nanoid());
        });

        logger.debug(`Stream > ${alias} > info > response`);
        logger.debug(`- request time: ${timeText}`);

        return result;
    }
}

export { Streaming }
