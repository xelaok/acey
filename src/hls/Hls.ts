import * as Hapi from "hapi";
import { HlsConfig } from "../config";
import { FFmpeg } from "../ffmpeg";
import { Streaming } from "../streaming";
import { Channel } from "../types";
import { ChannelService } from "./ChannelService";

class Hls {
    private readonly hlsConfig: HlsConfig;
    private readonly ffmpeg: FFmpeg;
    private readonly streaming: Streaming;
    private readonly channelServices: Map<string, ChannelService>;

    constructor(
        hlsConfig: HlsConfig,
        ffmpeg: FFmpeg,
        streaming: Streaming,
    ) {
        this.hlsConfig = hlsConfig;
        this.ffmpeg = ffmpeg;
        this.streaming = streaming;
        this.channelServices = new Map();
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
        profileName: string,
        filename: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        const service = this.resolveChannelService(channel, profileName);

        if (!service) {
            return h.response().code(404);
        }

        return service.handleRequest(request, h, filename);
    }

    async close(): Promise<void> {
        this.channelServices.forEach(s => s.close());
        this.channelServices.clear();
    }

    private resolveChannelService(channel: Channel, profileName: string): ChannelService | null {
        const profile = this.hlsConfig[profileName];

        if (!profile) {
            return null;
        }

        const id = `${channel.source}-${channel.id}-${profileName}`;

        let service = this.channelServices.get(id);

        if (!service) {
            service = new ChannelService(
                channel,
                profile,
                this.ffmpeg,
                this.streaming,
            );

            service.onClosed = () => {
                this.channelServices.delete(id);
            };

            service.open();
            this.channelServices.set(id, service);
        }

        return service;
    }
}

export { Hls }
