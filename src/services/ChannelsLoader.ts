import { ChannelsRepository } from "./ChannelsRepository";
import { loadTtvChannels } from "../utils/loadTtvChannels";

class ChannelsLoader {
    private readonly playlistUrl: string;
    private readonly intervalSeconds: number;
    private readonly channelsRepository: ChannelsRepository;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;

    constructor(
        playlistUrl: string,
        intervalSeconds: number,
        channelsRepository: ChannelsRepository
    ) {
        this.playlistUrl = playlistUrl;
        this.intervalSeconds = intervalSeconds;
        this.channelsRepository = channelsRepository;
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        await loadTtvChannels(this.playlistUrl, this.channelsRepository);

        this.timeout = global.setInterval(
            async () => {
                await loadTtvChannels(this.playlistUrl, this.channelsRepository);
            },
            this.intervalSeconds * 1000,
        );

        console.log("ChannelsLoader started.");
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        global.clearInterval(this.timeout);
    }
}

export { ChannelsLoader }
