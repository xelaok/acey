import { Dict, logger, forget } from "../../base";
import { StreamGroup, StreamType, TtvStream } from "../../types";
import { AppData } from "../../app-data";
import { TtvApi } from "../../ttv-api";
import { TtvStreamRepository } from "../../repositories";
import { Source, GetStreamsResult } from "../types";

class TtvSource implements Source {
    private updateInterval: number;
    private ttvStreamRepository: TtvStreamRepository;
    private appData: AppData;
    private groupsMap: Dict<StreamGroup>;
    private ttvApi: TtvApi;
    private timeout: NodeJS.Timeout;
    private isRunning: boolean = false;
    private lastFetched: number | null = null;

    constructor(
        updateInterval: number,
        ttvStreamRepository: TtvStreamRepository,
        appData: AppData,
        groupsMap: Dict<StreamGroup>,
        ttvApi: TtvApi,
    ) {
        this.updateInterval = updateInterval;
        this.ttvStreamRepository = ttvStreamRepository;
        this.appData = appData;
        this.groupsMap = groupsMap;
        this.ttvApi = ttvApi;
    }

    async start(): Promise<void> {
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
            this.ttvStreamRepository.update(channels);
        }

        if (this.isUpdateNeeded()) {
            logger.info("Loading TTV streams...");
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
            streams: this.ttvStreamRepository.getAll(),
            streamType: StreamType.Ttv,
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
        const lastFetched = Date.now();

        logger.debug("TTV Source > load ..");
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

            this.ttvStreamRepository.update(channels);

            logger.debug(`TTV Source > load > success (${channels.length} channels)`);
        }
        catch (error) {
            logger.debug(`TTV Source > load > failed > ${error.stack}`);
        }
        finally {
            this.lastFetched = lastFetched;
        }
    }
}

function buildTtvChannels(
    channelsList: any[],
    channelCategoryList: any[],
    channelGroupsMap: Dict<StreamGroup>,
): TtvStream[] {
    const categoryGroupMap = channelCategoryList.reduce(
        (map, c) => map.set(c.id, channelGroupsMap[c.name]),
        new Map(),
    );

    const result = new Map<string, TtvStream>();

    for (const c of channelsList) {
        result.set(c["id"], {
            id: c["id"],
            name: c["name"],
            group: categoryGroupMap.get(c["category_id"]) || null,
            logoUrl: c["logo"],
        });
    }

    return Array.from(result.values());
}

export { TtvSource }
