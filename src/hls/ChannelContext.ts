import Hapi from "hapi";
import { createLogger, getMimeType, forget, Logger } from "../base";
import { HlsProfile } from "../config";
import { FFmpegService } from "../ffmpeg";
import { StreamService, AceStreamRequestResult } from "../stream";
import { Channel } from "../types";
import { PlaylistContext } from "./PlaylistContext";

type InitResult = {
    playlistContext: PlaylistContext;
    streamRequestResult: AceStreamRequestResult;
};

class ChannelContext {
    onClosed: (() => void) | undefined;

    private readonly channel: Channel;
    private readonly profile: HlsProfile;
    private readonly ffmpegService: FFmpegService;
    private readonly streamService: StreamService;
    private readonly logger: Logger;
    private isOpened: boolean;
    private initResult$: Promise<InitResult | null> | null;

    constructor(
        channel: Channel,
        profile: HlsProfile,
        ffmpegService: FFmpegService,
        streamService: StreamService,
    ) {
        this.channel = channel;
        this.profile = profile;
        this.ffmpegService = ffmpegService;
        this.streamService = streamService;
        this.logger = createLogger(c => c`{magenta HLS > ${channel.name}}`);
        this.isOpened = false;
        this.initResult$ = null;
    }

    open(): void {
        if (this.isOpened) {
            return;
        }

        this.logger.verbose("open");
        this.isOpened = true;
        this.initResult$ = this.init();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.logger.verbose("close");
        this.isOpened = false;
        const initResult = await this.initResult$;

        if (initResult) {
            this.streamService.closeRequest(initResult.streamRequestResult);
            await initResult.playlistContext.close();
        }
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
        const content = await initResult.playlistContext.getContent(filename);

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
        const streamRequestResult = await this.streamService.createRequest(this.channel);
        const response = await streamRequestResult.response$;

        if (!response || response.status !== 200) {
            this.closeSelf();
            return null;
        }

        const playlistContext = new PlaylistContext(
            this.profile,
            streamRequestResult.stream,
            this.ffmpegService,
            this.channel.name,
        );

        playlistContext.onClosed = async () => {
            this.closeSelf();
        };

        await playlistContext.open();

        return { streamRequestResult, playlistContext };
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }
}

export { ChannelContext }
