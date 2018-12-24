class StreamSharedBuffer {
    chunks: Buffer[];

    private maxLength: number;
    private timestamps: number[];

    constructor(maxLength: number) {
        this.maxLength = maxLength;
        this.chunks = [];
        this.timestamps = [];
    }

    public write(chunk: Buffer): void {
        const now = Date.now();

        this.removeOverdueChunks(now);

        this.chunks.push(chunk);
        this.timestamps.push(now);
    }

    private removeOverdueChunks(now: number): void {
        let k = 0;
        const minTime = now - this.maxLength;

        while (k < this.timestamps.length && this.timestamps[k] < minTime) {
            k++;
        }

        this.chunks.splice(0, k);
        this.timestamps.splice(0, k);
    }
}

export { StreamSharedBuffer }
