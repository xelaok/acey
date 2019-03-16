import { tryReadFile } from "./tryReadFile";

type FileContentWatcherHandler = {
    (content: string): void;
};

class FileContentWatcher {
    private readonly filename: string;
    private readonly pollInterval: number;
    private readonly highWaterMark: number;
    private readonly handler: FileContentWatcherHandler;
    private timeout: NodeJS.Timeout | null;
    private currentContent: string | null;

    constructor(
        filename: string,
        pollInterval: number,
        highWaterMark: number,
        handler: FileContentWatcherHandler,
    ) {
        this.filename = filename;
        this.pollInterval = pollInterval;
        this.highWaterMark = highWaterMark;
        this.handler = handler;
        this.timeout = null;
        this.currentContent = null;
    }

    watch(): void {
        if (this.timeout) {
            return;
        }

        this.setTimeout();
    }

    close(): void {
        if (!this.timeout) {
            return;
        }

        global.clearTimeout(this.timeout);
        this.timeout = null;
    }

    private setTimeout(): void {
        this.timeout = global.setTimeout(
            async () => {
                const buffer = tryReadFile(this.filename, this.highWaterMark);

                if (buffer) {
                    const content = buffer.toString();

                    if (!this.currentContent || this.currentContent !== content) {
                        this.currentContent = content;
                        this.handler(content);
                    }
                }

                this.setTimeout();
            },
            this.pollInterval,
        );
    }
}

export { FileContentWatcher, FileContentWatcherHandler }
