import fs from "fs";
import { Readable } from "stream";

type ScheduledFileReaderOptions = {
    path: string;
    timeout: number;
    highWaterMark: number;
    onSchedule: () => void;
};

class ScheduledFileReader {
    private readonly path: string;
    private readonly timeout: number;
    private readonly highWaterMark: number;
    private readonly onSchedule: () => void;
    private canceled: boolean = false;
    private readStartTime: number | undefined;

    constructor({ path, timeout, highWaterMark, onSchedule }: ScheduledFileReaderOptions) {
        this.path = path;
        this.timeout = timeout;
        this.highWaterMark = highWaterMark;
        this.onSchedule = onSchedule;
    }

    async read(): Promise<Readable | null> {
        this.readStartTime = Date.now();

        let stream = await this.tryRead();

        if (!stream) {
            stream = await new Promise(resolve => this.scheduleRead(resolve));
        }

        return stream;
    }

    cancel(): void {
        this.canceled = true;
    }

    private scheduleRead(resolve: (stream: Readable | null) => void): void {
        this.onSchedule();

        global.setTimeout(async () => {
            if (this.canceled) {
                resolve(null);
                return;
            }

            if (this.readStartTime && Date.now() - this.readStartTime > this.timeout) {
                resolve(null);
                return;
            }

            const stream = await this.tryRead();

            if (!stream) {
                this.scheduleRead(resolve);
                return;
            }

            resolve(stream);
        }, 250);
    }

    private tryRead(): Promise<Readable | null> {
        return new Promise(resolve => {
            fs.access(this.path, fs.constants.R_OK, err => {
                if (err) {
                    resolve(null);
                    return;
                }

                resolve(
                    fs.createReadStream(this.path, {
                        highWaterMark: this.highWaterMark,
                    }),
                );
            });
        });
    }
}

export { ScheduledFileReader, ScheduledFileReaderOptions }
