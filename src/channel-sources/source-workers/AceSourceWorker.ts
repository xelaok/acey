import { Dict, logger, fetchContent, forget, FetchContentResult } from "../../base";
import { ChannelRepository } from "../../channel-repository";
import { AppData } from "../../app-data";
import { parseAcePlaylist } from "../../playlist-util";
import { ChannelGroup, Channel, ChannelSource } from "../../types";
import { ChannelSourceWorker } from "../types";

class AceSourceWorker implements ChannelSourceWorker {
    private readonly url: string;
    private readonly updateInterval: number;
    private readonly channelRepository: ChannelRepository;
    private readonly appData: AppData;
    private readonly groupsMap: Dict<ChannelGroup>;
    private timeout: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastFetched: number | null = null;
    private fetchResult: FetchContentResult | null = null;

    constructor(
        url: string,
        updateInterval: number,
        channelRepository: ChannelRepository,
        appData: AppData,
        groupsMap: Dict<ChannelGroup>,
    ) {
        this.url = url;
        this.updateInterval = updateInterval;
        this.channelRepository = channelRepository;
        this.appData = appData;
        this.groupsMap = groupsMap;
    }

    async open(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        const data = await this.appData.readAceSource(this.url);

        if (data) {
            this.lastFetched = data.lastFetched;
            this.fetchResult = data.fetchResult;

            const streams = parseAcePlaylist(data.fetchResult.content, this.groupsMap);
            this.channelRepository.updateAceChannels(streams);
        }

        if (this.isUpdateNeeded()) {
            logger.info("Fetching Ace streams...");
            await this.load();
        }

        this.schedule();
    }

    async close(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.timeout) {
            global.clearInterval(this.timeout);
        }
    }

    getChannels(): Channel[] {
        return this.channelRepository.getAceChannels();
    }

    private schedule(): void {
        const delay = this.lastFetched
            ? this.updateInterval + this.lastFetched - Date.now()
            : this.updateInterval
        ;

        this.timeout = global.setTimeout(
            async () => {
                await this.load();
                this.schedule();
            },
            delay,
        );
    }

    private isUpdateNeeded(): boolean {
        return (
            !this.lastFetched ||
            Date.now() >= this.lastFetched + this.updateInterval
        );
    }

    private async load(): Promise<void> {
        logger.debug("Ace Source > load ..");
        try {
            const fetchResult = await fetchContent(
                this.url,
                this.fetchResult ? this.fetchResult.lastModifiedString : null,
            );

            this.lastFetched = Date.now();

            if (fetchResult) {
                this.fetchResult = fetchResult;
            }

            if (this.fetchResult) {
                forget(
                    this.appData.writeAceSource(this.url, {
                        lastFetched: this.lastFetched,
                        fetchResult: this.fetchResult,
                    })
                );
            }

            if (!fetchResult) {
                logger.debug("Ace Source > load > success (not modified)");
                return;
            }

            const streams = parseAcePlaylist(fetchResult.content, this.groupsMap);

            if (streams.length === 0) {
                logger.warn(`No Ace streams loaded`);
                return;
            }

            this.channelRepository.updateAceChannels(streams);
            logger.debug(`Ace Source > load > success (${streams.length} streams)`);
        }
        catch (error) {
            logger.warning(`Ace Source > load > failed > ${error.stack}`);
        }
    }
}

export { AceSourceWorker }
