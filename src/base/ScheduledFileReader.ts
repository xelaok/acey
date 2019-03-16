import { tryReadFile } from "./tryReadFile";

class ScheduledFileReader {
    private readonly path: string;
    private readonly highWaterMark: number;
    private canceled: boolean = false;

    constructor(path: string, highWaterMark: number) {
        this.path = path;
        this.highWaterMark = highWaterMark;
    }

    async read(): Promise<Buffer | null> {
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
