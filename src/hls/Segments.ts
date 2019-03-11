import path from "path";
import { meanBy,  sumBy } from "lodash";
import { HlsProfile } from "../config";
import { HlsPlaylistSegment } from "./types";

type PlaylistSegment = {
    name: string;
    length: number;
    content$: Promise<Buffer | null>;
};

class Segments {
    private readonly profile: HlsProfile;
    private readonly arr: PlaylistSegment[];
    private readonly map: Map<string, PlaylistSegment>;
    private sequence: number;
    private timestamp: number;
    private start: number;
    private end: number;
    private activeLength: number;
    private queuedLength: number;
    private unusedLength: number;

    constructor(profile: HlsProfile) {
        this.profile = profile;
        this.arr = [];
        this.map = new Map();
        this.sequence = Date.now();
        this.timestamp = 0;
        this.start = -1;
        this.end = -1;
        this.activeLength = 0;
        this.queuedLength = 0;
        this.unusedLength = 0;
    }

    isReady(): boolean {
        return this.activeLength >= this.profile.minInitListLength;
    }

    getMediaSequence(): number {
        return this.sequence + this.start;
    }

    calculateTargetDuration(): number {
        return Math.round(meanBy(this.extractActive(), s => s.length) / 1e3);
    }

    extractActive(): PlaylistSegment[] {
        return this.arr.slice(this.start, this.end + 1);
    }

    extractQueued(): PlaylistSegment[] {
        return this.arr.slice(this.end + 1);
    }

    extractUnused(): PlaylistSegment[] {
        return this.arr.slice(0, this.start);
    }

    getByName(name: string): PlaylistSegment | null {
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
        let length = 0;
        let removeEnd = this.start - 1;

        while (true) {
            if (removeEnd < 0) {
                break;
            }

            length += this.arr[removeEnd].length;
            removeEnd--;

            if (length >= this.profile.deleteThresholdLength) {
                break;
            }
        }

        const removedSegments = this.arr.splice(0, removeEnd + 1);

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

        try {
            if (!this.timestamp) {
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
        catch (err) {
            console.log(this.arr);
            console.log(start, end, activeLength, queuedLength, unusedLength);
            throw err;
        }
    }
}

export { Segments, PlaylistSegment }
