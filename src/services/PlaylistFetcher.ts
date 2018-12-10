import { ChannelRepository } from "./ChannelRepository";
import { logger } from "../libs/logger";
import { fetchAcePlaylist } from "../utils/playlist/fetchAcePlaylist";
import { parseAcePlaylist } from "../utils/playlist/parseAcePlaylist";
import { getChannelFromAceChannel } from "../utils/channel/getChannelFromAceChannel";
import { ChannelGroupsParseMap, PlaylistFetcherOptions } from "../types";

class PlaylistFetcher {
    private readonly options: PlaylistFetcherOptions;
    private readonly channelGroupsParseMap: ChannelGroupsParseMap;
    private readonly channelRepository: ChannelRepository;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;
    private acePlaylistLastModified: string | null = null;

    constructor(
        options: PlaylistFetcherOptions,
        channelGroupsParseMap: ChannelGroupsParseMap,
        channelRepository: ChannelRepository,
    ) {
        this.options = options;
        this.channelGroupsParseMap = channelGroupsParseMap;
        this.channelRepository = channelRepository;
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        await this.fetchAcePlaylist();

        this.timeout = global.setInterval(
            () => this.fetchAcePlaylist(),
            this.options.acePlaylist.interval * 1000 * 60,
        );
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        global.clearInterval(this.timeout);
    }

    private async fetchAcePlaylist(): Promise<void> {
        logger.debug("PlaylistFetcher > fetch ace playlist");
        try {
            const result = await fetchAcePlaylist(
                this.options.acePlaylist.url,
                this.acePlaylistLastModified,
            );

            if (!result.modified) {
                logger.debug("PlaylistFetcher > fetch ace playlist > success (not modified)");
                return;
            }

            this.acePlaylistLastModified = result.lastModified;

            const aceChannels = parseAcePlaylist(result.content, this.channelGroupsParseMap);

            if (aceChannels.length === 0) {
                logger.warn(`No channels loaded`);
                return;
            }

            const channels = aceChannels.map(ac => getChannelFromAceChannel(ac));
            this.channelRepository.update(channels);

            logger.debug(`PlaylistFetcher > fetch ace playlist > success (${channels.length} channels)`);
        }
        catch (error) {
            logger.warn(`PlaylistFetcher > fetch ace playlist > failed > ${error.stack}`);
        }
    }
}

export { PlaylistFetcher }
