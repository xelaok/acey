import * as Hapi from "hapi";
import { HlsConfig } from "../config";
import { FFmpeg } from "../ffmpeg";
import { Streaming } from "../streaming";
import { Channel, ChannelSource } from "../types";
import { HlsStream } from "./HlsStream";

class Hls {
    private readonly hlsConfig: HlsConfig;
    private readonly ffmpeg: FFmpeg;
    private readonly streaming: Streaming;
    private readonly streams: Map<string, HlsStream> = new Map();

    constructor(
        hlsConfig: HlsConfig,
        ffmpeg: FFmpeg,
        streaming: Streaming,
    ) {
        this.hlsConfig = hlsConfig;
        this.ffmpeg = ffmpeg;
        this.streaming = streaming;
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
        profileName: string,
        filename: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        const profile = this.hlsConfig[profileName];

        if (!profile) {
            return h.response().code(404);
        }

        const id = formatStreamId(channel, profileName);

        let hlsStream = this.streams.get(id);

        if (!hlsStream) {
            const newHlsStream = new HlsStream(
                channel,
                profile,
                this.ffmpeg,
                this.streaming,
            );

            this.streams.set(id, newHlsStream);

            newHlsStream.onFinish = () => {
                this.streams.delete(id);
            };

            hlsStream = newHlsStream;
        }

        return hlsStream.handleRequest(request, h, filename);
    }

    async close(): Promise<void> {
        const streams = Array.from(this.streams.values());
        this.streams.clear();

        await Promise.all(streams.map(s => s.close()));
    }
}

function formatStreamId(channel: Channel, profileName: string): string {
    switch (channel.source) {
        case ChannelSource.Ace:
            return `ace-${channel.id}-${profileName}`;
        case ChannelSource.Ttv:
            return `ttv-${channel.id}-${profileName}`;
        default:
            throw new Error(`Unknown channel source type.`);
    }
}

export { Hls }
