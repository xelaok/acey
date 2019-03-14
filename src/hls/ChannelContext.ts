import Hapi from "hapi";
import { createLogger, getMimeType, forget, Logger, GatewayError } from "../base";
import { HlsProfile } from "../config";
import { FFmpegService } from "../ffmpeg";
import { StreamService, AceStreamClient } from "../stream";
import { Channel } from "../types";
import { PlaylistContext } from "./PlaylistContext";

type InitResult = {
    streamClient: AceStreamClient;
    playlistContext: PlaylistContext;
};

class ChannelContext {
    onClosed: (() => void) | undefined;

    private readonly channel: Channel;
    private readonly initialSequence: number;
    private readonly profile: HlsProfile;
    private readonly ffmpegService: FFmpegService;
    private readonly streamService: StreamService;
    private readonly logger: Logger;
    private initResult$: Promise<InitResult | null> | null;

    constructor(
        channel: Channel,
        initialSequence: number,
        profile: HlsProfile,
        ffmpegService: FFmpegService,
        streamService: StreamService,
    ) {
        this.channel = channel;
        this.initialSequence = initialSequence;
        this.profile = profile;
        this.ffmpegService = ffmpegService;
        this.streamService = streamService;
        this.logger = createLogger(c => c`{magenta HLS > ${channel.name}}`);
        this.initResult$ = null;
    }

    open(): void {
        if (this.initResult$) {
            return;
        }

        this.logger.verbose("open");
        this.initResult$ = this.init();

        this.initResult$.then(result => {
            if (!result) {
                this.closeSelf();
            }
        });
    }

    async close(): Promise<void> {
        if (!this.initResult$) {
            return;
        }

        this.logger.verbose("close");

        const promise = this.initResult$.then(async (result) => {
           if (!result) {
               return;
           }

           this.streamService.closeClient(result.streamClient);
           await result.playlistContext.close();
        });

        this.initResult$ = null;

        return promise;
    }

    async handleRequest(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        filename: string,
    ): Promise<Hapi.ResponseObject | symbol> {
        if (!this.initResult$) {
            throw new Error("Can't create a request for a non-open channel.");
        }

        const initResult = await this.initResult$;

        if (!request.active()) {
            return h.close;
        }

        if (!initResult) {
            return h.response().code(502);
        }

        const content = await initResult.playlistContext.getContent(filename);

        if (!request.active()) {
            return h.close;
        }

        if (content === null) {
            return h.response().code(404);
        }

        return h.response(content).type(getMimeType(filename) || "");
    }

    private async init(): Promise<InitResult | null> {
        let streamClient;

        try {
            streamClient = await this.streamService.addClient(this.channel);
        }
        catch (err) {
            if (err instanceof GatewayError) {
                return null;
            }
            throw err;
        }

        const playlistContext = new PlaylistContext(
            this.profile,
            streamClient.stream,
            this.ffmpegService,
            this.channel.name,
            this.initialSequence,
        );

        playlistContext.onClosed = async () => {
            this.closeSelf();
        };

        await playlistContext.open();

        return { streamClient, playlistContext };
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }
}

export { ChannelContext }
