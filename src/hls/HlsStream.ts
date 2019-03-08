import Hapi from "hapi";
import { logger, getMimeType } from "../base";
import { HlsProfile } from "../config";
import { FFmpeg } from "../ffmpeg";
import { Streaming, StreamContext, StreamRequest } from "../streaming";
import { Channel } from "../types";
import { HlsBuilder } from "./HlsBuilder";

type InitResult = {
    streamContext: StreamContext;
    streamRequest: StreamRequest;
    builder: HlsBuilder;
};

class HlsStream {
    onClosed: (() => void) | undefined;

    private readonly channel: Channel;
    private readonly profile: HlsProfile;
    private readonly ffmpeg: FFmpeg;
    private readonly streaming: Streaming;
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

        const initResult$ = this.initResult$;

        this.isOpened = false;
        this.initResult$ = null;

        const initResult = await initResult$;

        if (!initResult) {
            return;
        }

        const { streamContext, streamRequest, builder } = initResult;

        await builder.close();
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
        const content = await initResult.builder.getResource(filename);

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
        logger.verbose(`HLS > ${this.channel.name} > init`);

        const streamContext = await this.streaming.getContext(this.channel);
        const streamRequest = streamContext.createRequest();
        const response = await streamRequest.response$;

        if (!response || response.status !== 200) {
            return null;
        }

        const builder = new HlsBuilder(
            this.profile,
            streamRequest.stream,
            this.ffmpeg,
            this.channel.name
        );

        builder.onClosed = async () => {
            await this.close();
            this.onClosed && this.onClosed();
        };

        await builder.open();

        return { streamContext, streamRequest, builder };
    }
}

export { HlsStream }
