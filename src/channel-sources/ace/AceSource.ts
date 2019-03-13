import { Dict, logger, createLogger, fetchContent, forget, Logger, FetchContentResult } from "../../base";
import { ChannelRepository } from "../../channel-repository";
import { AppData } from "../../app-data";
import { parsePlaylist } from "./parsePlaylist";
import { ChannelGroup, Channel, ChannelSource } from "../../types";
import { ChannelSourceWorker } from "../types";

class AceSource implements ChannelSourceWorker {
    private readonly url: string;
    private readonly updateInterval: number;
    private readonly channelRepository: ChannelRepository;
    private readonly appData: AppData;
    private readonly groupsMap: Dict<ChannelGroup>;
    private readonly logger: Logger;
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
        this.logger = createLogger(c => c`{cyan Ace Source}`);
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

            const streams = parsePlaylist(data.fetchResult.content, this.groupsMap);
            this.channelRepository.updateAceChannels(streams);
        }

        if (this.isUpdateNeeded()) {
            logger.info(`Fetching Ace streams...`);
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
        this.logger.debug(`load ..`);
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
                this.logger.debug(`load > success (not modified)`);
                return;
            }

            const streams = parsePlaylist(fetchResult.content, this.groupsMap);

            if (streams.length === 0) {
                logger.warn(`No Ace streams loaded`);
                return;
            }

            this.channelRepository.updateAceChannels(streams);
            this.logger.debug(c => c`load > success ({bold ${streams.length.toString()}} streams)`);
        }
        catch (error) {
            this.logger.warn(`load > failed`);
            this.logger.warn(error.stack);
        }
    }
}

export { AceSource }
