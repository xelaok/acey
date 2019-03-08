import path from "path";
import { Readable } from "stream";
import fsa from "fs-extra";
import format from "string-format";
import { sumBy, mean } from "lodash";
import { logger, forget, delay, tryReadFile, ScheduledFileReader, Timer, CRLF } from "../base";
import { HlsProfile } from "../config";
import { FFmpeg, FFmpegWorker } from "../ffmpeg";
import { HlsIndex, HlsSegment } from "./types";
import { HLS_INDEX_PLAYLIST_NAME } from "./consts";
import { parseIndex } from "./utils/parseIndex";

const READ_SOURCE_FILE_HIGH_WATERMARK = 1 << 20;
const READ_SOURCE_INDEX_FILE_HIGHWATERMARK = 1 << 16;
const PULL_SOURCE_INDEX_INTERVAL = 100;
const UPDATE_INDEX_INTERVAL = 1000;

type Segment = {
    name: string;
    sourceName: string;
    length: number;
    content$: Promise<Buffer | null>;
};

class HlsBuilder {
    onClosed: (() => void) | undefined;

    private readonly profile: HlsProfile;
    private readonly stream: Readable;
    private readonly ffmpeg: FFmpeg;
    private readonly alias: string;
    private readonly segments: Segment[];
    private readonly segmentsMap: Map<string, Segment>;
    private readonly idleTimer: Timer;
    private readonly ffmpegWorker: FFmpegWorker;
    private readonly initialTimestamp: number;
    private isOpened: boolean;
    private sequence: number;
    private timestamp: number;
    private indexCounter: number;
    private initialSourceIndex$: Promise<HlsIndex | null> | null;
    private buildIndexTimeout: NodeJS.Timeout | undefined;
    private pullSourceIndexTimeout: NodeJS.Timeout | undefined;
    private previousSourceIndex: HlsIndex | undefined;
    private previousSourceIndexContent: string | undefined;
    private previousSourceSegmentNames: Set<string> | undefined;

    constructor(profile: HlsProfile, stream: Readable, ffmpeg: FFmpeg, alias: string) {
        this.profile = profile;
        this.stream = stream;
        this.ffmpeg = ffmpeg;
        this.alias = alias;
        this.segments = [];
        this.segmentsMap = new Map();
        this.idleTimer = this.createIdleTimer();
        this.ffmpegWorker = this.createFfmpegWorker();
        this.initialTimestamp = Date.now();
        this.isOpened = false;
        this.sequence = this.initialTimestamp;
        this.timestamp = 0;
        this.indexCounter = 0;
        this.initialSourceIndex$ = null;
    }

    async open(): Promise<void> {
        if (this.isOpened) {
            return;
        }

        this.isOpened = true;

        this.pullInitialSourceIndex();
        this.schedulePullSourceIndex();
        this.scheduleUpdateIndex();

        await this.ffmpegWorker.open();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.isOpened = false;
        this.idleTimer.stop();

        if (this.pullSourceIndexTimeout) {
            global.clearTimeout(this.pullSourceIndexTimeout);
        }

        if (this.buildIndexTimeout) {
            global.clearTimeout(this.buildIndexTimeout);
        }

        await this.ffmpegWorker.close();
    }

    getResource(name: string): Promise<Buffer | string | null> {
        this.idleTimer.reset();

        if (!this.isOpened) {
            return Promise.resolve(null);
        }

        return name === HLS_INDEX_PLAYLIST_NAME
            ? this.getIndex()
            : this.getContent(name)
            ;
    }

    private async getIndex(): Promise<string | null> {
        const initialSourceIndex = await this.initialSourceIndex$;

        if (!initialSourceIndex) {
            return null;
        }

        await this.pullLatestSourceIndex();

        const activeRange = this.getActiveSegmentsRange(Date.now());

        const unusedSegments = this.segments.slice(0, activeRange.start);
        const activeSegments = this.segments.slice(activeRange.start, activeRange.end + 1);
        const queuedSegments = this.segments.slice(activeRange.end + 1);
        const sequence = this.sequence + activeRange.start;
        const targetDuration = Math.round(mean(activeSegments.map(s => s.length)) / 1e3);

        this.logIndex(
            sequence,
            targetDuration,
            unusedSegments,
            activeSegments,
            queuedSegments,
        );

        return this.formatIndex(
            sequence,
            targetDuration,
            activeSegments,
            initialSourceIndex,
        );
    }

    private async getContent(name: string): Promise<Buffer | null> {
        const segment = this.segmentsMap.get(name);

        if (!segment) {
            return tryReadFile(
                this.resolveFilePath(name),
                READ_SOURCE_FILE_HIGH_WATERMARK
            );
        }

        const content = await segment.content$;

        if (!content) {
            return null;
        }

        this.logSegment(segment, content.length);

        return content;
    }

    private createFfmpegWorker(): FFmpegWorker {
        const hlsTime = Math.ceil(this.profile.segmentLength / 1000);
        const hlsListSize = 100;

        const ffmpegArgs = format(this.profile.ffmpegArgs, {
            hlsTime,
            hlsListSize,
            index: HLS_INDEX_PLAYLIST_NAME,
        });

        const worker = this.ffmpeg.createWorker(ffmpegArgs, this.stream, this.alias);

        worker.onClosed = async () => {
            await this.close();
            this.onClosed && this.onClosed();
        };

        return worker;
    }

    private createIdleTimer(): Timer {
        return new Timer(this.profile.idleTimeout, async () => {
            logger.debug(`HLS > ${this.alias} > idle timeout`);
            await this.close();
            this.onClosed && this.onClosed();
        });
    }

    private schedulePullSourceIndex(): void {
        this.pullSourceIndexTimeout = global.setTimeout(
            async () => {
                const success = await this.pullUpdatedSourceIndex();

                if (success) {
                    this.schedulePullSourceIndex();
                }
            },
            PULL_SOURCE_INDEX_INTERVAL,
        );
    }

    private scheduleUpdateIndex(): void {
        this.buildIndexTimeout = global.setTimeout(
            async () => {
                await this.initialSourceIndex$;
                const activeRange = this.getActiveSegmentsRange(Date.now());
                this.removeSegments(activeRange.start);
                this.scheduleUpdateIndex();
            },
            UPDATE_INDEX_INTERVAL,
        );
    }

    private pullInitialSourceIndex(): void {
        this.initialSourceIndex$ = this.pullSourceIndex(true, false);

        this.initialSourceIndex$.then(index => {
            if (index) {
                this.idleTimer.start();
                this.timestamp = Date.now();
            }
        });
    }

    private async pullLatestSourceIndex(): Promise<boolean> {
        const initialIndex = await this.initialSourceIndex$;

        if (!initialIndex) {
            return false;
        }

        const index = await this.pullSourceIndex(false, false);
        return !!index;
    }

    private async pullUpdatedSourceIndex(): Promise<boolean> {
        const initialIndex = await this.initialSourceIndex$;

        if (!initialIndex) {
            return false;
        }

        const index = await this.pullSourceIndex(false, true);
        return !!index;
    }

    private async pullSourceIndex(prebuffer: boolean, updatedOnly: boolean): Promise<HlsIndex | null> {
        let result;

        while (true) {
            result = await this.readSourceIndex(updatedOnly);

            if (!result) {
                break;
            }

            this.pullSourceSegments(result);

            if (!prebuffer) {
                break;
            }

            const totalLength = sumBy(this.segments, s => s.length);
            const requiredLength = this.profile.minListLength + this.profile.minPrebufferLength;

            if (totalLength >= requiredLength) {
                break;
            }
        }

        return result;
    }

    private async readSourceIndex(updatedOnly: boolean): Promise<HlsIndex | null> {
        let result;
        const delayLoop = () => delay(PULL_SOURCE_INDEX_INTERVAL);

        while (true) {
            if (!this.isOpened) {
                result = null;
                break;
            }

            const reader = new ScheduledFileReader({
                path: this.resolveFilePath(HLS_INDEX_PLAYLIST_NAME),
                timeout: this.profile.requestTimeout,
                highWaterMark: READ_SOURCE_INDEX_FILE_HIGHWATERMARK,
            });

            const buffer = await reader.read();

            if (!buffer) {
                result = null;
                break;
            }

            const content = buffer.toString();
            const isUpdated = content !== this.previousSourceIndexContent;

            if (!isUpdated && updatedOnly) {
                await delayLoop();
                continue;
            }

            if (!isUpdated && this.previousSourceIndex) {
                result = this.previousSourceIndex;
                break;
            }

            const index = parseIndex(content);
            const isValid = index.segments.length !== 0;

            if (!isValid) {
                await delayLoop();
                continue;
            }

            result = index;
            this.previousSourceIndex = index;
            this.previousSourceIndexContent = content;

            break;
        }

        return result;
    }

    private pullSourceSegments(index: HlsIndex): void {
        const newSourceSegmentNames = new Set();

        for (const s of index.segments) {
            newSourceSegmentNames.add(s.name);

            if (this.previousSourceSegmentNames && this.previousSourceSegmentNames.has(s.name)) {
                continue;
            }

            const content$ = this.pullSourceSegment(s.name);
            this.addSegment(s, content$);
        }

        this.previousSourceSegmentNames = newSourceSegmentNames;
    }

    private async pullSourceSegment(name: string): Promise<Buffer | null> {
        const path = this.resolveFilePath(name);

        const buffer = await tryReadFile(path, READ_SOURCE_FILE_HIGH_WATERMARK);
        forget(fsa.unlink(path));

        return buffer;
    }

    private getActiveSegmentsRange(time: number): { start: number, end: number } {
        let start = 0;
        let end = this.segments.length - 1;
        let length = sumBy(this.segments, s => s.length);
        let queuedCount = 0;
        let queuedLength = 0;
        let timestampOffset = this.timestamp;

        while (true) {
            const segment = this.segments[start];

            if (length - segment.length <= this.profile.minListLength) {
                break;
            }

            if (timestampOffset + segment.length >= time) {
                break;
            }

            start += 1;
            length -= segment.length;
            timestampOffset += segment.length;
        }

        while (true) {
            const segment = this.segments[end];

            if (length - segment.length <= this.profile.minListLength) {
                break;
            }

            end -= 1;
            length -= segment.length;
            queuedCount += 1;
            queuedLength += segment.length;
        }

        while (true) {
            if (queuedCount === 0) {
                break;
            }

            if (length >= this.profile.maxListLength) {
                break;
            }

            const segment = this.segments[end + 1];

            if (queuedLength - segment.length < this.profile.minPrebufferLength) {
                break;
            }

            end += 1;
            length += segment.length;
            queuedCount -= 1;
            queuedLength -= segment.length;
        }

        return { start, end };
    }

    private addSegment(source: HlsSegment, content$: Promise<Buffer | null>): void {
        const sourceName = source.name;
        const name = `${this.initialTimestamp + this.indexCounter}${path.extname(sourceName)}`;
        const length = source.length;

        const segment = {
            name,
            sourceName,
            length,
            content$,
        };

        this.indexCounter += 1;
        this.segments.push(segment);
        this.segmentsMap.set(segment.name, segment);
    }

    private removeSegments(activeStartIndex: number): void {
        let length = 0;
        let removeEndIndex = activeStartIndex - 1;

        while (true) {
            if (removeEndIndex < 0) {
                break;
            }

            length += this.segments[removeEndIndex].length;
            removeEndIndex--;

            if (length >= this.profile.deleteThresholdLength) {
                break;
            }
        }

        const removedSegments = this.segments.splice(0, removeEndIndex + 1);

        for (const s of removedSegments) {
            this.sequence += 1;
            this.timestamp += s.length;
            this.segmentsMap.delete(s.name);
        }
    }

    private resolveFilePath(name: string): string {
        return path.join(this.ffmpegWorker.workingDirectory, name);
    }

    private formatIndex(
        sequence: number,
        targetDuration: number,
        segments: Segment[],
        sourceIndex: HlsIndex,
    ): string {
        const tags = sourceIndex.tags.map(tag => {
            switch (tag.name) {
                case "#EXT-X-TARGETDURATION":
                    return {
                        name: tag.name,
                        value: targetDuration,
                    };

                case "#EXT-X-MEDIA-SEQUENCE":
                    return {
                        name: tag.name,
                        value: sequence,
                    };

                default:
                    return tag;
            }
        });

        const lines = [];
        lines.push("#EXTM3U");

        for (const t of tags) {
            lines.push(`${t.name}:${t.value}`);
        }

        for (const s of segments) {
            lines.push(`#EXTINF:${(s.length / 1e3).toFixed(6)},`);
            lines.push(s.name);
        }

        return lines.join(CRLF);
    }

    private logIndex(
        sequence: number,
        targetDuration: number,
        unusedSegments: Segment[],
        activeSegments: Segment[],
        queuedSegments: Segment[],
    ): void {
        const unusedCount = unusedSegments.length;
        const activeCount = activeSegments.length;
        const queuedCount = queuedSegments.length;

        const unusedLength = sumBy(unusedSegments, s => s.length);
        const activeLength = sumBy(activeSegments, s => s.length);
        const queuedLength = sumBy(queuedSegments, s => s.length);

        const unusedText = `${(unusedLength / 1e3).toFixed(2)}s (${unusedCount})`;
        const activeText = `${(activeLength / 1e3).toFixed(2)}s (${activeCount})`;
        const queuedText = `${(queuedLength / 1e3).toFixed(2)}s (${queuedCount})`;

        logger.debug(`HLS > ${this.alias} > index (seq: ${sequence}, td: ${targetDuration}, unused: ${unusedText}, active: ${activeText}, queued: ${queuedText})`);
    }

    private logSegment(segment: Segment, size: number): void {
        const sizeText = `${(size / (1 << 20)).toFixed(2)} MiB`;
        const lengthText = `${(segment.length / 1e3).toFixed(2)}s`;

        logger.debug(`HLS > ${this.alias} > ${segment.name} (length: ${lengthText}, size: ${sizeText})`);
    }
}

export { HlsBuilder }
