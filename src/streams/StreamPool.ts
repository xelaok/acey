import nanoid from "nanoid";
import { logger, stopWatch } from "../base";
import { StreamConfig, AceEngineConfig } from "../config";
import * as aceApi from "../ace-api";
import { Stream } from "./Stream";

class StreamPool {
    private streamConfig: StreamConfig;
    private aceEngineConfig: AceEngineConfig;
    private streamsBySource: Map<string, Stream> = new Map();
    private streamsByPlaybackId: Map<string, Stream> = new Map();

    constructor(streamConfig: StreamConfig, aceEngineConfig: AceEngineConfig) {
        this.streamConfig = streamConfig;
        this.aceEngineConfig = aceEngineConfig;
    }

    async resolve(source: aceApi.StreamSource, alias: string): Promise<Stream> {
        let stream = this.streamsBySource.get(source.value);

        if (stream) {
            return stream;
        }

        const info = await this.getStreamInfo(source, alias);

        stream = this.streamsByPlaybackId.get(info.playbackId);

        if (stream) {
            stream.updateInfo(info);
            return stream;
        }

        stream = new Stream(
            this.streamConfig,
            this.aceEngineConfig,
            source,
            info,
            alias,
        );

        this.streamsBySource.set(source.value, stream);
        this.streamsByPlaybackId.set(info.playbackId, stream);

        stream.onStopped = () => {
            this.streamsBySource.delete(source.value);
            this.streamsByPlaybackId.delete(info.playbackId);
        };

        stream.start();

        return stream;
    }

    async dispose(): Promise<void> {
        const streams = Array.from(this.streamsBySource.values());
        await Promise.all(streams.map(s => s.dispose()));
    }

    private async getStreamInfo(
        source: aceApi.StreamSource,
        alias: string,
    ): Promise<aceApi.StreamInfo> {
        logger.debug(`${alias} > info ..`);

        const { timeText, result } = await stopWatch(() => {
            return aceApi.getStreamInfo(this.aceEngineConfig.path, source, nanoid());
        });

        logger.debug(`${alias} > info > response`);
        logger.debug(`- request time: ${timeText}`);

        return result;
    }
}

export { StreamPool }
