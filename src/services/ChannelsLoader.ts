import { ChannelRepository } from "./ChannelRepository";
import { fetchAcePlaylist } from "../utils/playlist/fetchAcePlaylist";
import { parseAcePlaylist } from "../utils/playlist/parseAcePlaylist";
import { getChannelFromAceChannel } from "../utils/channel/getChannelFromAceChannel";

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

        await this.loadAceChannels();

        this.timeout = global.setInterval(
            () => this.loadAceChannels(),
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

    private async loadAceChannels(): Promise<void> {
        console.log("Load Ace channels...");
        try {
            const acePlaylist = await fetchAcePlaylist(this.playlistUrl);
            const aceChannels = parseAcePlaylist(acePlaylist);
            const channels = aceChannels.map(ac => getChannelFromAceChannel(ac));

            this.channelRepository.update(channels);
            console.log(`Load Ace channels success (${channels.length} items).`);
        }
        catch (error) {
            console.log("Load Ace channels failed.");
            console.error(error);
        }
    }
}

export { ChannelsLoader }
