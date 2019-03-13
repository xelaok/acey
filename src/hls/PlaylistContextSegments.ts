import path from "path";
import { meanBy,  sumBy } from "lodash";
import { HlsProfile } from "../config";
import { HlsPlaylistSegment } from "./types";

type PlaylistContextSegment = {
    name: string;
    length: number;
    content$: Promise<Buffer | null>;
};

class PlaylistContextSegments {
    private readonly profile: HlsProfile;
    private readonly arr: PlaylistContextSegment[];
    private readonly map: Map<string, PlaylistContextSegment>;
    private sequence: number;
    private activeLength: number;
    private queuedLength: number;
    private unusedLength: number;
    private timestamp: number | null;
    private start: number | null;
    private end: number | null;

    constructor(profile: HlsProfile) {
        this.profile = profile;
        this.arr = [];
        this.map = new Map();
        this.sequence = Date.now();
        this.activeLength = 0;
        this.queuedLength = 0;
        this.unusedLength = 0;
        this.timestamp = null;
        this.start = null;
        this.end = null;
    }

    isReady(): boolean {
        return this.activeLength >= this.profile.minInitListLength;
    }

    getMediaSequence(): number {
        if (this.start === null) {
            throw this.createNotYetReadyError();
        }

        return this.sequence + this.start;
    }

    calculateTargetDuration(): number {
        return Math.round(meanBy(this.extractActive(), s => s.length) / 1e3);
    }

    extractActive(): PlaylistContextSegment[] {
        if (this.start === null || this.end === null) {
            throw this.createNotYetReadyError();
        }

        return this.arr.slice(this.start, this.end + 1);
    }

    extractQueued(): PlaylistContextSegment[] {
        if (this.end === null) {
            throw this.createNotYetReadyError();
        }

        return this.arr.slice(this.end + 1);
    }

    extractUnused(): PlaylistContextSegment[] {
        if (this.start === null) {
            throw this.createNotYetReadyError();
        }

        return this.arr.slice(0, this.start);
    }

    getByName(name: string): PlaylistContextSegment | null {
        return this.map.get(name) || null;
    }

    add(source: HlsPlaylistSegment, content$: Promise<Buffer | null>): void {
        const segment = {
            name: `${this.sequence + this.arr.length}${path.extname(source.name)}`,
            length: source.length,
            content$,
        };

        this.arr.push(segment);
        this.map.set(segment.name, segment);
    }

    removeOutdated(): void {
        if (this.timestamp === null || this.start === null) {
            return;
        }

        const currentTime = Date.now();

        let end = this.start - 1;
        let endTimestamp = this.timestamp + sumBy(this.arr.slice(0, end + 1), s => s.length);

        while (true) {
            if (end < 0) {
                break;
            }

            if (endTimestamp < currentTime - this.profile.deleteThresholdLength) {
                break;
            }

            endTimestamp -= this.arr[end].length;
            end -= 1;
        }

        const removedSegments = this.arr.splice(0, end + 1);

        for (const s of removedSegments) {
            this.sequence += 1;
            this.timestamp += s.length;
            this.map.delete(s.name);
        }
    }

    update(): void {
        const currentTime = Date.now();

        let start = 0;
        let end = this.arr.length - 1;
        let activeLength = sumBy(this.arr, s => s.length);
        let queuedLength = 0;
        let unusedLength = 0;

        const reserveQueue = () => {
            while (true) {
                if (activeLength === 0) {
                    break;
                }

                if (queuedLength >= this.profile.minPrebufferLength) {
                    break;
                }

                const endSegment = this.arr[end];

                end -= 1;
                activeLength -= endSegment.length;
                queuedLength += endSegment.length;
            }
        };

        const setActiveFromCurrentTime = () => {
            if (this.timestamp === null) {
                return;
            }

            let startTimestamp = this.timestamp;

            for (let i = 0; i < start; i++) {
                startTimestamp += this.arr[i].length;
            }

            while (true) {
                if (activeLength === 0) {
                    break;
                }

                const startSegment = this.arr[start];

                if (startTimestamp + startSegment.length >= currentTime) {
                    break;
                }

                start += 1;
                startTimestamp += startSegment.length;
                activeLength -= startSegment.length;
                unusedLength += startSegment.length;
            }
        };

        const limitActiveToMaxLength = () => {
            while (true) {
                if (activeLength <= this.profile.maxListLength) {
                    break;
                }

                const endSegment = this.arr[end];

                end -= 1;
                activeLength -= endSegment.length;
                queuedLength += endSegment.length;
            }
        };

        const compensateActiveFromQueue = () => {
            while (true) {
                if (queuedLength === 0) {
                    break;
                }

                if (activeLength >= this.profile.minListLength) {
                    break;
                }

                const segment = this.arr[end + 1];

                end += 1;
                activeLength += segment.length;
                queuedLength -= segment.length;
            }
        };

        const compensateActiveFromUnused = () => {
            while (true) {
                if (unusedLength === 0) {
                    break;
                }

                if (activeLength >= this.profile.minListLength) {
                    break;
                }

                const segment = this.arr[start - 1];

                start -= 1;
                activeLength += segment.length;
                unusedLength -= segment.length;
            }
        };

        const save = () => {
            this.start = start;
            this.end = end;
            this.activeLength = activeLength;
            this.queuedLength = queuedLength;
            this.unusedLength = unusedLength;
        };

        if (this.timestamp === null) {
            reserveQueue();
            save();

            if (this.isReady()) {
                this.timestamp = currentTime;
            }
        }
        else {
            reserveQueue();
            setActiveFromCurrentTime();
            limitActiveToMaxLength();
            compensateActiveFromQueue();
            compensateActiveFromUnused();
            save();
        }
    }

    private createNotYetReadyError(): Error {
        return new Error("The list of segments is not yet ready.");
    }
}

export { PlaylistContextSegments, PlaylistContextSegment }
