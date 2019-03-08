import fs from "fs";
import { Readable } from "stream";
import { tryReadFile } from "./tryReadFile";

type ScheduledFileReaderOptions = {
    path: string;
    timeout: number;
    highWaterMark: number;
};

class ScheduledFileReader {
    private readonly path: string;
    private readonly timeout: number;
    private readonly highWaterMark: number;
    private canceled: boolean = false;
    private readStartTime: number | undefined;

    constructor({ path, timeout, highWaterMark }: ScheduledFileReaderOptions) {
        this.path = path;
        this.timeout = timeout;
        this.highWaterMark = highWaterMark;
    }

    async read(): Promise<Buffer | null> {
        this.readStartTime = Date.now();

        let buffer = await tryReadFile(this.path, this.highWaterMark);

        if (!buffer) {
            buffer = await new Promise(resolve => this.scheduleRead(resolve));
        }

        return buffer;
    }

    cancel(): void {
        this.canceled = true;
    }

    private scheduleRead(resolve: (buffer: Buffer | null) => void): void {
        global.setTimeout(async () => {
            if (this.canceled) {
                resolve(null);
                return;
            }

            if (this.readStartTime && Date.now() - this.readStartTime > this.timeout) {
                resolve(null);
                return;
            }

            const buffer = await tryReadFile(this.path, this.highWaterMark);

            if (buffer) {
                resolve(buffer);
                return;
            }

            this.scheduleRead(resolve);
        }, 100);
    }
}

export { ScheduledFileReader, ScheduledFileReaderOptions }
