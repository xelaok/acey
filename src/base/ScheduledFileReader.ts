import { tryReadFile } from "./tryReadFile";

class ScheduledFileReader {
    private readonly path: string;
    private readonly highWaterMark: number;
    private canceled: boolean = false;
    private readStartTime: number | undefined;
    private readTimeout: NodeJS.Timeout | null;

    constructor(path: string, highWaterMark: number) {
        this.path = path;
        this.highWaterMark = highWaterMark;
        this.readTimeout = null;
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

        if (this.readTimeout) {
            global.clearTimeout(this.readTimeout);
            this.readTimeout = null;
        }
    }

    private scheduleRead(resolve: (buffer: Buffer | null) => void): void {
        this.readTimeout = global.setTimeout(async () => {
            if (this.canceled) {
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

export { ScheduledFileReader }
