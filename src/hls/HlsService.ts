import * as Hapi from "hapi";
import { HlsConfig } from "../config";
import { FFmpegService } from "../ffmpeg";
import { StreamService } from "../stream";
import { Channel } from "../types";
import { ChannelContext } from "./ChannelContext";

class HlsService {
    private readonly hlsConfig: HlsConfig;
    private readonly ffmpegService: FFmpegService;
    private readonly streamService: StreamService;
    private readonly channelContexts: Map<string, ChannelContext>;

    constructor(
        hlsConfig: HlsConfig,
        ffmpegService: FFmpegService,
        streamService: StreamService,
    ) {
        this.hlsConfig = hlsConfig;
        this.ffmpegService = ffmpegService;
        this.streamService = streamService;
        this.channelContexts = new Map();
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        channel: Channel,
        profileName: string,
        filename: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        const channelContext = this.resolveChannelContext(channel, profileName);

        if (!channelContext) {
            return h.response().code(404);
        }

        return channelContext.handleRequest(request, h, filename);
    }

    async close(): Promise<void> {
        this.channelContexts.forEach(s => s.close());
        this.channelContexts.clear();
    }

    private resolveChannelContext(channel: Channel, profileName: string): ChannelContext | null {
        const profile = this.hlsConfig[profileName];

        if (!profile) {
            return null;
        }

        const id = `${channel.source}-${channel.id}-${profileName}`;

        let context = this.channelContexts.get(id);

        if (!context) {
            context = new ChannelContext(
                channel,
                profile,
                this.ffmpegService,
                this.streamService,
            );

            context.onClosed = () => {
                this.channelContexts.delete(id);
            };

            context.open();
            this.channelContexts.set(id, context);
        }

        return context;
    }
}

export { HlsService }
