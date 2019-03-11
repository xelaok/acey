import { logger, createLogger, forget, Logger, Dict } from "../../base";
import { ChannelGroup, Channel, ChannelSource, TtvChannel } from "../../types";
import { ChannelRepository } from "../../channel-repository";
import { AppData } from "../../app-data";
import { TtvApi } from "../../ttv-api";
import { ChannelSourceWorker } from "../types";

class TtvSourceWorker implements ChannelSourceWorker {
    private readonly updateInterval: number;
    private readonly channelRepository: ChannelRepository;
    private readonly appData: AppData;
    private readonly groupsMap: Dict<ChannelGroup>;
    private readonly ttvApi: TtvApi;
    private readonly logger: Logger;
    private timeout: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastFetched: number | null = null;

    constructor(
        updateInterval: number,
        channelRepository: ChannelRepository,
        appData: AppData,
        groupsMap: Dict<ChannelGroup>,
        ttvApi: TtvApi,
    ) {
        this.updateInterval = updateInterval;
        this.channelRepository = channelRepository;
        this.appData = appData;
        this.groupsMap = groupsMap;
        this.ttvApi = ttvApi;
        this.logger = createLogger(c => c`{white TTV Source}`);
    }

    async open(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        const data = await this.appData.readTtvSource(this.ttvApi.session);

        if (data) {
            const channels = buildTtvChannels(
                data.rawChannels,
                data.rawChannelCategories,
                this.groupsMap,
            );

            this.lastFetched = data.lastFetched;
            this.channelRepository.updateTtvChannels(channels);
        }

        if (this.isUpdateNeeded()) {
            logger.info("Loading TTV streams...");
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
        return this.channelRepository.getTtvChannels();
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
        const lastFetched = Date.now();

        this.logger.debug("load ..");
        try {
            const [
                rawChannels,
                rawChannelCategories,
            ] = await Promise.all([
                this.ttvApi.getRawChannels(),
                this.ttvApi.getRawChannelCategories(),
            ]);

            forget(
                this.appData.writeTtvSource(this.ttvApi.session, {
                    lastFetched,
                    rawChannels,
                    rawChannelCategories,
                })
            );

            const channels = buildTtvChannels(
                rawChannels,
                rawChannelCategories,
                this.groupsMap,
            );

            if (channels.length === 0) {
                logger.warn(`No TTV streams loaded`);
                return;
            }

            this.channelRepository.updateTtvChannels(channels);
            this.logger.debug(c => c`load > success ({bold ${channels.length.toString()}} channels)`);
        }
        catch (error) {
            this.logger.debug(`load > failed > ${error.stack}`);
        }
        finally {
            this.lastFetched = lastFetched;
        }
    }
}

function buildTtvChannels(
    channelsList: any[],
    channelCategoryList: any[],
    channelGroupsMap: Dict<ChannelGroup>,
): TtvChannel[] {
    const categoryGroupMap = channelCategoryList.reduce(
        (map, c) => map.set(c.id, channelGroupsMap[c.name]),
        new Map(),
    );

    const result = new Map<string, TtvChannel>();

    for (const c of channelsList) {
        result.set(c["id"], {
            id: c["id"].toString(),
            name: c["name"],
            group: categoryGroupMap.get(c["category_id"]) || null,
            logoUrl: c["logo"],
            source: ChannelSource.Ttv,
        });
    }

    return Array.from(result.values());
}

export { TtvSourceWorker }
