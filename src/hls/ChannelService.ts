import Hapi from "hapi";
import { createLogger, getMimeType, forget, Logger } from "../base";
import { HlsProfile } from "../config";
import { FFmpeg } from "../ffmpeg";
import { Streaming, StreamContext, StreamRequest } from "../streaming";
import { Channel } from "../types";
import { PlaylistService } from "./PlaylistService";

type InitResult = {
    streamContext: StreamContext;
    streamRequest: StreamRequest;
    playlist: PlaylistService;
};

class ChannelService {
    onClosed: (() => void) | undefined;

    private readonly channel: Channel;
    private readonly profile: HlsProfile;
    private readonly ffmpeg: FFmpeg;
    private readonly streaming: Streaming;
    private readonly logger: Logger;
    private isOpened: boolean;
    private initResult$: Promise<InitResult | null> | null;

    constructor(
        channel: Channel,
        profile: HlsProfile,
        ffmpeg: FFmpeg,
        streaming: Streaming,
    ) {
        this.channel = channel;
        this.profile = profile;
        this.ffmpeg = ffmpeg;
        this.streaming = streaming;
        this.logger = createLogger(c => c`{magenta HLS > ${channel.name}}`);
        this.isOpened = false;
        this.initResult$ = null;
    }

    open(): void {
        if (this.isOpened) {
            return;
        }

        this.isOpened = true;
        this.initResult$ = this.init();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.logger.debug(`close`);

        const initResult$ = this.initResult$;

        this.isOpened = false;
        this.initResult$ = null;

        const initResult = await initResult$;

        if (!initResult) {
            return;
        }

        const { streamContext, streamRequest, playlist } = initResult;

        await playlist.close();
        streamContext.deleteRequest(streamRequest);
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        filename: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        const initResult = await this.initResult$;

        if (!request.active()) {
            return h.close;
        }

        if (!initResult) {
            return h.response().code(502);
        }

        const mimeType = getMimeType(filename);
        const content = await initResult.playlist.getContent(filename);

        if (!request.active()) {
            return h.close;
        }

        if (content === null) {
            return h.response().code(404);
        }

        let result = h.response(content);

        if (mimeType) {
            result = result.type(mimeType);
        }

        return result;
    }

    private async init(): Promise<InitResult | null> {
        this.logger.verbose(`init`);

        const streamContext = await this.streaming.getContext(this.channel);
        const streamRequest = streamContext.createRequest();
        const response = await streamRequest.response$;

        if (!response || response.status !== 200) {
            this.closeSelf();
            return null;
        }

        const playlist = new PlaylistService(
            this.profile,
            streamRequest.stream,
            this.ffmpeg,
            this.channel.name
        );

        playlist.onClosed = async () => {
            this.closeSelf();
        };

        await playlist.open();

        return { streamContext, streamRequest, playlist };
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }
}

export { ChannelService }
