class Timer {
    private readonly duration: number;
    private readonly handler: () => void;
    private time: number;
    private timeout: NodeJS.Timeout | null;

    constructor(duration: number, handler: () => void) {
        this.duration = duration;
        this.handler = handler;
        this.time = 0;
        this.timeout = null;
    }

    start(): void {
        if (this.timeout) {
            return;
        }

        this.time = Date.now() + this.duration;
        this.setTimeout(this.duration);
    }

    stop(): void {
        if (!this.timeout) {
            return;
        }

        global.clearTimeout(this.timeout);

        this.time = 0;
        this.timeout = null;
    }

    reset(): void {
        if (!this.timeout) {
            return;
        }

        this.time = Date.now() + this.duration;
    }

    private setTimeout(delay: number): void {
        this.timeout = global.setTimeout(
            () => {
                if (!this.timeout) {
                    return;
                }

                const timeLeft = this.time - Date.now();

                if (timeLeft > 0) {
                    this.setTimeout(timeLeft);
                    return;
                }

                global.clearTimeout(this.timeout);

                this.time = 0;
                this.timeout = null;

                this.handler();
            },
            delay,
        );
    }
}

export { Timer }
