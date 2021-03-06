import path from "path";
import { Readable } from "stream";
import fsa from "fs-extra";
import format from "string-format";
import { sumBy } from "lodash";
import { createLogger, forget, delay, tryReadFile, Logger, ScheduledFileReader, Timer, CRLF } from "../base";
import { HlsProfile } from "../config";
import { FFmpegService, FFmpegTask } from "../ffmpeg";
import { HlsPlaylist } from "./types";
import { HLS_PLAYLIST_NAME } from "./consts";
import { parsePlaylist } from "./parsePlaylist";
import { PlaylistContextSegments, PlaylistContextSegment } from "./PlaylistContextSegments";

const READ_SOURCE_PLAYLIST_HIGHWATERMARK = 1 << 16;
const READ_SOURCE_PLAYLIST_CONTENT_HIGH_WATERMARK = 1 << 20;
const UPDATE_PLAYLIST_INTERVAL = 1000;
const PULL_SOURCE_PLAYLIST_INTERVAL = 100;

class PlaylistContext {
    onClosed: (() => void) | undefined;

    private readonly profile: HlsProfile;
    private readonly stream: Readable;
    private readonly ffmpeg: FFmpegService;
    private readonly alias: string;
    private readonly logger: Logger;
    private readonly segments: PlaylistContextSegments;
    private readonly idleTimer: Timer;
    private readonly ffmpegTask: FFmpegTask;
    private readonly activeFileReaders: Set<ScheduledFileReader>;
    private isOpened: boolean;
    private initialSourcePlaylist$: Promise<HlsPlaylist | null> | undefined;
    private previousSourcePlaylist: HlsPlaylist | undefined;
    private previousSourcePlaylistContent: string | undefined;
    private previousSourceSegmentNames: Set<string> | undefined;

    constructor(
        profile: HlsProfile,
        stream: Readable,
        ffmpeg: FFmpegService,
        alias: string,
        initialSequence: number,
    ) {
        this.profile = profile;
        this.stream = stream;
        this.ffmpeg = ffmpeg;
        this.alias = alias;
        this.logger = createLogger(c => c`{magenta HLS > ${alias}}`);
        this.segments = new PlaylistContextSegments(profile, initialSequence);
        this.idleTimer = this.createIdleTimer();
        this.ffmpegTask = this.createFfmpegTask();
        this.activeFileReaders = new Set();
        this.isOpened = false;
    }

    async open(): Promise<void> {
        if (this.isOpened) {
            return;
        }

        this.isOpened = true;
        this.initialSourcePlaylist$ = this.pullSourcePlaylist("initial");

        this.initialSourcePlaylist$.then(() => {
            if (!this.isOpened) {
                return;
            }

            this.idleTimer.start();
        });

        this.scheduleUpdatePlaylist();
        this.schedulePullSourcePlaylist();

        await this.ffmpegTask.open();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.isOpened = false;
        this.idleTimer.stop();

        for (let reader of this.activeFileReaders) {
            reader.cancel();
        }

        await this.ffmpegTask.close();
    }

    getContent(name: string): Promise<Buffer | string | null> {
        if (!this.isOpened) {
            return Promise.resolve(null);
        }

        this.idleTimer.reset();

        return name === HLS_PLAYLIST_NAME
            ? this.getPlaylist()
            : this.getPlaylistContent(name)
            ;
    }

    private async getPlaylist(): Promise<string | null> {
        const initialSourcePlaylist = await this.initialSourcePlaylist$;

        if (!initialSourcePlaylist) {
            return null;
        }

        await this.pullSourcePlaylist("latest");

        this.segments.update();
        const activeSegments = this.segments.extractActive();
        const queuedSegments = this.segments.extractQueued();
        const unusedSegments = this.segments.extractUnused();
        const mediaSequence = this.segments.getMediaSequence();
        const targetDuration = this.segments.calculateTargetDuration();

        this.logPlaylist(
            mediaSequence,
            targetDuration,
            unusedSegments,
            activeSegments,
            queuedSegments,
        );

        return this.formatPlaylist(
            mediaSequence,
            targetDuration,
            activeSegments,
            initialSourcePlaylist,
        );
    }

    private async getPlaylistContent(name: string): Promise<Buffer | null> {
        const segment = this.segments.getByName(name);

        if (!segment) {
            return tryReadFile(
                this.resolveFilePath(name),
                READ_SOURCE_PLAYLIST_CONTENT_HIGH_WATERMARK
            );
        }

        const content = await segment.content$;

        if (!content) {
            return null;
        }

        this.logSegment(segment, content.length);

        return content;
    }

    private createFfmpegTask(): FFmpegTask {
        const hlsTime = Math.ceil(this.profile.segmentLength / 1000);
        const hlsListSize = 32;

        const ffmpegArgs = format(this.profile.ffmpegArgs, {
            hlsTime,
            hlsListSize,
            index: HLS_PLAYLIST_NAME,
        });

        const task = this.ffmpeg.createTask(ffmpegArgs, this.stream, this.alias);

        task.onClosed = async () => {
            this.closeSelf();
        };

        return task;
    }

    private createIdleTimer(): Timer {
        return new Timer(this.profile.idleTimeout, async () => {
            this.logger.debug(`idle timeout`);
            this.closeSelf();
        });
    }

    private scheduleUpdatePlaylist(): void {
        global.setTimeout(
            async () => {
                await this.initialSourcePlaylist$;

                if (!this.isOpened) {
                    return;
                }

                this.segments.update();
                this.segments.removeOutdated();

                this.scheduleUpdatePlaylist();
            },
            UPDATE_PLAYLIST_INTERVAL,
        );
    }

    private schedulePullSourcePlaylist(): void {
        global.setTimeout(
            async () => {
                const initialPlaylist = await this.initialSourcePlaylist$;

                if (!initialPlaylist) {
                    return;
                }

                if (!this.isOpened) {
                    return;
                }

                await this.pullSourcePlaylist("updated");
                await this.schedulePullSourcePlaylist();
            },
            PULL_SOURCE_PLAYLIST_INTERVAL,
        );
    }

    private async pullSourcePlaylist(mode: "initial" | "latest" | "updated"): Promise<HlsPlaylist | null> {
        while (true) {
            const playlist = await this.readSourcePlaylist(mode === "updated");

            if (!playlist) {
                return null;
            }

            this.pullSourceSegments(playlist);

            if (mode === "initial") {
                this.segments.update();
                if (!this.segments.isReady()) {
                    continue;
                }
            }

            return playlist;
        }
    }

    private async readSourcePlaylist(updatedOnly: boolean): Promise<HlsPlaylist | null> {
        while (true) {
            if (!this.isOpened) {
                return null;
            }

            const reader = new ScheduledFileReader(
                this.resolveFilePath(HLS_PLAYLIST_NAME),
                READ_SOURCE_PLAYLIST_HIGHWATERMARK,
            );

            this.activeFileReaders.add(reader);
            const buffer = await reader.read();
            this.activeFileReaders.delete(reader);

            if (!buffer) {
                return null;
            }

            const content = buffer.toString();
            const isUpdated = content !== this.previousSourcePlaylistContent;

            if (!isUpdated && updatedOnly) {
                await delay(PULL_SOURCE_PLAYLIST_INTERVAL);
                continue;
            }

            if (!isUpdated && this.previousSourcePlaylist) {
                return this.previousSourcePlaylist;
            }

            const playlist = parsePlaylist(content);

            if (!playlist) {
                this.logger.silly("Can't parse source playlist, content:");
                this.logger.silly(content);

                await delay(PULL_SOURCE_PLAYLIST_INTERVAL);
                continue;
            }

            this.previousSourcePlaylist = playlist;
            this.previousSourcePlaylistContent = content;

            return playlist;
        }
    }

    private pullSourceSegments(playlist: HlsPlaylist): void {
        const newSourceSegmentNames = new Set();

        for (const s of playlist.segments) {
            newSourceSegmentNames.add(s.name);

            if (this.previousSourceSegmentNames && this.previousSourceSegmentNames.has(s.name)) {
                continue;
            }

            this.segments.add(s, this.pullSourceSegment(s.name));
        }

        this.previousSourceSegmentNames = newSourceSegmentNames;
    }

    private async pullSourceSegment(name: string): Promise<Buffer | null> {
        const path = this.resolveFilePath(name);

        const buffer = await tryReadFile(path, READ_SOURCE_PLAYLIST_CONTENT_HIGH_WATERMARK);
        forget(fsa.unlink(path));

        return buffer;
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }

    private resolveFilePath(name: string): string {
        return path.join(this.ffmpegTask.workingDirectory, name);
    }

    private formatPlaylist(
        mediaSequence: number,
        targetDuration: number,
        segments: PlaylistContextSegment[],
        source: HlsPlaylist,
    ): string {
        const tags = source.tags.map(tag => {
            switch (tag.name) {
                case "#EXT-X-TARGETDURATION":
                    return {
                        name: tag.name,
                        value: targetDuration,
                    };

                case "#EXT-X-MEDIA-SEQUENCE":
                    return {
                        name: tag.name,
                        value: mediaSequence,
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

    private logPlaylist(
        mediaSequence: number,
        targetDuration: number,
        unusedSegments: PlaylistContextSegment[],
        activeSegments: PlaylistContextSegment[],
        queuedSegments: PlaylistContextSegment[],
    ): void {
        this.logger.debug(c => {
            const activeCount = activeSegments.length;
            const queuedCount = queuedSegments.length;
            const unusedCount = unusedSegments.length;

            const activeLength = sumBy(activeSegments, s => s.length);
            const queuedLength = sumBy(queuedSegments, s => s.length);
            const unusedLength = sumBy(unusedSegments, s => s.length);

            const activeText = c`{bold ${(activeLength / 1e3).toFixed(2)}s} ({bold ${activeCount.toString()}})`;
            const queuedText = c`{bold ${(queuedLength / 1e3).toFixed(2)}s} ({bold ${queuedCount.toString()}})`;
            const unusedText = c`{bold ${(unusedLength / 1e3).toFixed(2)}s} ({bold ${unusedCount.toString()}})`;

            return c`{bold playlist} (ms: {bold ${mediaSequence.toString()}}, td: {bold ${targetDuration.toString()}}, a: ${activeText}, q: ${queuedText}, u: ${unusedText})`;
        });
    }

    private logSegment(segment: PlaylistContextSegment, size: number): void {
        const sizeText = `${(size / (1 << 20)).toFixed(2)} MiB`;
        const lengthText = `${(segment.length / 1e3).toFixed(2)}s`;
        const bitrateText = `${((size * 8 / 1e6) / (segment.length / 1e3)).toFixed(2)} mbit/s`;

        this.logger.debug(c => c`{bold ${segment.name}} ({bold ${lengthText}}, {bold ${sizeText}}, {bold ${bitrateText}})`);
    }
}

export { PlaylistContext }
