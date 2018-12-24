import { Dict, logger, fetchContent, forget, FetchContentResult } from "../../base";
import { AppData } from "../../app-data";
import { AceStreamRepository } from "../../repositories";
import { parsePlaylist } from "../../playlist-util";
import { StreamGroup, StreamType } from "../../types";
import { Source, GetStreamsResult } from "../types";

class AceSource implements Source {
    private url: string;
    private updateInterval: number;
    private aceStreamRepository: AceStreamRepository;
    private appData: AppData;
    private groupsMap: Dict<StreamGroup>;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;
    private lastFetched: number | null = null;
    private fetchResult: FetchContentResult | null = null;

    constructor(
        url: string,
        updateInterval: number,
        aceStreamRepository: AceStreamRepository,
        appData: AppData,
        groupsMap: Dict<StreamGroup>,
    ) {
        this.url = url;
        this.updateInterval = updateInterval;
        this.aceStreamRepository = aceStreamRepository;
        this.appData = appData;
        this.groupsMap = groupsMap;
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        const data = await this.appData.readAceSource(this.url);

        if (data) {
            this.lastFetched = data.lastFetched;
            this.fetchResult = data.fetchResult;

            const streams = parsePlaylist(data.fetchResult.content, this.groupsMap);
            this.aceStreamRepository.update(streams);
        }

        if (this.isUpdateNeeded()) {
            logger.info("Fetching Ace streams...");
            await this.load();
        }

        this.schedule();
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        global.clearInterval(this.timeout);
    }

    getStreams(): GetStreamsResult {
        return {
            streams: this.aceStreamRepository.getAll(),
            streamType: StreamType.Ace,
        };
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

            const streams = parsePlaylist(fetchResult.content, this.groupsMap);

            if (streams.length === 0) {
                logger.warn(`No Ace streams loaded`);
                return;
            }

            this.aceStreamRepository.update(streams);
            logger.debug(`Ace Source > load > success (${streams.length} streams)`);
        }
        catch (error) {
            logger.warning(`Ace Source > load > failed > ${error.stack}`);
        }
    }
}

export { AceSource }
