import path from "path";
import Hapi from "hapi";
import format from "string-format";
import { logger, forget, getMimeType, readStream, delay, ScheduledFileReader, Timer } from "../base";
import { HlsProfile } from "../config";
import { FFmpeg, FFmpegWorker } from "../ffmpeg";
import { Streaming } from "../streaming";
import { Channel } from "../types";
import { HLS_INDEX_PLAYLIST_NAME } from "./consts";
import { parseIndexLength } from "./utils/parseIndexLength";
import { tryReadFile } from "./utils/tryReadFile";

type InitResult = {
    ffmpegWorker: FFmpegWorker;
};

const READ_FILE_HIGH_WATERMARK = 1 << 24;
const READ_INDEX_FILE_HIGHWATERMARK = 1 << 20;

class HlsStream {
    onFinish: (() => void) | undefined;

    private readonly channel: Channel;
    private readonly profile: HlsProfile;
    private readonly ffmpeg: FFmpeg;
    private readonly streaming: Streaming;
    private readonly idleTimer: Timer;
    private readonly initResult$: Promise<InitResult | null>;

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

        this.idleTimer = new Timer(profile.idleTimeout, async () => {
            logger.debug(`HLS > ${channel.name} > idle timeout`);
            forget(this.close());
        });

        this.initResult$ = this.init();
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
        const filePath = path.join(initResult.ffmpegWorker.workingDirectory, filename);

        let result;

        switch (true) {
            case filename === HLS_INDEX_PLAYLIST_NAME:
                result = this.readIndexFile(
                    request,
                    h,
                    filePath,
                    mimeType,
                );

                this.idleTimer.start();
                break;
            default:
                result = this.readFile(
                    request,
                    h,
                    filePath,
                    mimeType,
                );
        }

        return result;
    }

    async close(): Promise<void> {
        const initResult = await this.initResult$;

        if (initResult) {
            await initResult.ffmpegWorker.close();
        }
    }

    private async init(): Promise<InitResult | null> {
        logger.verbose(`HLS > ${this.channel.name} > init`);

        const { stream, response$ } = await this.streaming.requestChannel(this.channel);
        const response = await response$;

        if (!response || response.status !== 200) {
            return null;
        }

        const hlsTime = Math.ceil(this.profile.segmentLength / 1000);
        const hlsListSize = Math.ceil(this.profile.maxIndexLength / 1000 / hlsTime);
        const hlsDeleteThreshold = Math.ceil(this.profile.deleteThresholdLength / 1000 / hlsTime);

        const ffmpegArgs = format(this.profile.ffmpegArgs, {
            hlsTime,
            hlsListSize,
            hlsDeleteThreshold,
            index: HLS_INDEX_PLAYLIST_NAME,
        });

        const ffmpegWorker = this.ffmpeg.createWorker();

        ffmpegWorker.onFinish = () => {
            stream.end();
            this.idleTimer.stop();

            if (this.onFinish) {
                this.onFinish();
            }
        };

        forget(ffmpegWorker.run(ffmpegArgs, stream));

        return {
            ffmpegWorker,
        };
    }

    private async readFile(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        path: string,
        mimeType: string | null,
    ): Promise<Hapi.ResponseObject | symbol> {
        this.idleTimer.reset();
        const stream = await tryReadFile(path, READ_FILE_HIGH_WATERMARK);

        if (!request.active()) {
            return h.close;
        }

        if (!stream) {
            return h.response().code(404);
        }

        let result = h.response(stream);

        if (mimeType) {
            result = result.type(mimeType);
        }

        return result;
    }

    private async readIndexFile(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        path: string,
        mimeType: string | null,
    ): Promise<Hapi.ResponseObject | symbol> {
        while (true) {
            this.idleTimer.reset();

            const reader = new ScheduledFileReader({
                path,
                timeout: this.profile.requestTimeout,
                highWaterMark: READ_INDEX_FILE_HIGHWATERMARK,
            });

            const stream = await reader.read();

            if (!request.active()) {
                return h.close;
            }

            if (!stream) {
                return h.response().code(404);
            }

            const buffer = await readStream(stream);

            if (!request.active()) {
                return h.close;
            }

            const content = buffer.toString();
            const indexLength = parseIndexLength(content);

            if (indexLength < this.profile.minIndexLength) {
                await delay(250);

                if (!request.active()) {
                    return h.close;
                }

                continue;
            }

            let result = h.response(content);

            if (mimeType) {
                result = result.type(mimeType);
            }

            return result;
        }
    }
}

export { HlsStream }
