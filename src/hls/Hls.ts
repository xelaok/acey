import * as Hapi from "hapi";
import { HlsConfig } from "../config";
import { FFmpeg } from "../ffmpeg";
import { Streaming } from "../streaming";
import { Channel } from "../types";
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
        const stream = this.resolveStream(channel, profileName);

        if (!stream) {
            return h.response().code(404);
        }

        return stream.handleRequest(request, h, filename);
    }

    async close(): Promise<void> {
        this.streams.forEach(s => s.close());
        this.streams.clear();
    }

    private resolveStream(channel: Channel, profileName: string): HlsStream | null {
        const profile = this.hlsConfig[profileName];

        if (!profile) {
            return null;
        }

        const id = `${channel.source}-${channel.id}-${profileName}`;

        let stream = this.streams.get(id);

        if (!stream) {
            stream = new HlsStream(
                channel,
                profile,
                this.ffmpeg,
                this.streaming,
            );

            stream.onClosed = () => {
                this.streams.delete(id);
            };

            stream.open();
            this.streams.set(id, stream);
        }

        return stream;
    }
}

export { Hls }
