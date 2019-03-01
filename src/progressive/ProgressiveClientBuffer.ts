import { logger } from "../base";

class ProgressiveClientBuffer {
    size: number = 0;

    private readonly maxLength: number;
    private readonly resetLength: number;
    private readonly alias: string;
    private readonly streamAlias: string;
    private readonly chunks: Buffer[] = [];
    private readonly timestamps: number[] = [];

    constructor(
        maxLength: number,
        resetLength: number,
        alias: string,
        streamAlias: string,
    ) {
        this.maxLength = maxLength;
        this.resetLength = resetLength;
        this.alias = alias;
        this.streamAlias = streamAlias;
    }

    get isEmpty(): boolean {
        return this.size === 0;
    }

    push(chunk: Buffer): void {
        const now = Date.now();

        if (this.getLengthBy(now) > this.maxLength) {
            logger.warn(`${this.streamAlias} > client ${this.alias} > buffer overflow (chunks: ${this.chunks.length}, size: ${(this.size / 1024).toFixed(0)}KiB)`);
            this.resetBy(now);
        }

        this.chunks.push(chunk);
        this.timestamps.push(now);
        this.size += chunk.length;
    }

    pull(): Buffer | null {
        const chunk = this.chunks.shift();

        if (!chunk) {
            return null;
        }

        this.timestamps.shift();
        this.size -= chunk.length;

        return chunk;
    }

    private resetBy(time: number): void {
        let k = 0;

        while (k < this.timestamps.length && time - this.timestamps[k] > this.resetLength) {
            k++;
        }

        this.chunks.splice(0, k);
        this.timestamps.splice(0, k);
        this.size = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    }

    private getLengthBy(time: number): number {
        if (this.timestamps.length === 0) {
            return 0;
        }

        return time - this.timestamps[0];
    }
}

export { ProgressiveClientBuffer }
