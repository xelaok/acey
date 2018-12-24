class Timer {
    private duration: number;
    private handler: () => void;
    private time: number = 0;
    private timeout: NodeJS.Timeout | null = null;

    constructor(duration: number, handler: () => void) {
        this.duration = duration;
        this.handler = handler;
    }

    start(): void {
        this.time = Date.now() + this.duration;
        this.setTimeout(this.duration);
    }

    stop(): void {
        this.time = 0;
        this.clearTimeout();
    }

    reset(): void {
        this.time = Date.now() + this.duration;
    }

    private setTimeout(value: number): void {
        this.timeout = global.setTimeout(
            () => {
                const timeLeft = this.time - Date.now();

                if (timeLeft > 0) {
                    this.setTimeout(timeLeft);
                    return;
                }

                this.clearTimeout();
                this.handler();
            },
            value,
        );
    }

    private clearTimeout(): void {
        if (this.timeout) {
            global.clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}

export {
    Timer,
}
