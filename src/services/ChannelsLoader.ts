import { ChannelRepository } from "./ChannelRepository";
import { loadAceChannels } from "../utils/loadAceChannels";

class ChannelsLoader {
    private readonly playlistUrl: string;
    private readonly intervalSeconds: number;
    private readonly channelRepository: ChannelRepository;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;

    constructor(
        playlistUrl: string,
        intervalSeconds: number,
        channelRepository: ChannelRepository
    ) {
        this.playlistUrl = playlistUrl;
        this.intervalSeconds = intervalSeconds;
        this.channelRepository = channelRepository;
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        await loadAceChannels(this.playlistUrl, this.channelRepository);

        this.timeout = global.setInterval(
            async () => {
                await loadAceChannels(this.playlistUrl, this.channelRepository);
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
