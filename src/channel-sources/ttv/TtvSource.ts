import { formatErrorMessage, forget, logger, createLogger, Logger, Dict, UserError, GatewayError } from "../../base";
import { ChannelGroup, Channel, ChannelSource, TtvChannel } from "../../types";
import { ChannelRepository } from "../../channel-repository";
import { AppData } from "../../app-data";
import { TtvClient } from "../../ttv-client";
import { ChannelSourceWorker } from "../types";

class TtvSource implements ChannelSourceWorker {
    private readonly updateInterval: number;
    private readonly channelRepository: ChannelRepository;
    private readonly appData: AppData;
    private readonly groupsMap: Dict<ChannelGroup>;
    private readonly ttvClient: TtvClient;
    private readonly logger: Logger;
    private timeout: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private lastFetched: number | null = null;

    constructor(
        updateInterval: number,
        channelRepository: ChannelRepository,
        appData: AppData,
        groupsMap: Dict<ChannelGroup>,
        ttvClient: TtvClient,
    ) {
        this.updateInterval = updateInterval;
        this.channelRepository = channelRepository;
        this.appData = appData;
        this.groupsMap = groupsMap;
        this.ttvClient = ttvClient;
        this.logger = createLogger(c => c`{cyan TTV Source}`);
    }

    async open(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        if (!this.ttvClient.isEnabled()) {
            return;
        }

        const session = await this.ttvClient.getSession();

        if (!session) {
            return;
        }

        this.isRunning = true;

        const data = await this.appData.readTtvSource(session);

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
            logger.info(`Loading TTV channels...`);
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
        if (!this.ttvClient.isEnabled()) {
            return;
        }

        const session = await this.ttvClient.getSession();

        if (!session) {
            return;
        }

        const lastFetched = Date.now();

        this.logger.debug(`load ..`);
        try {
            const [
                rawChannels,
                rawChannelCategories,
            ] = await Promise.all([
                this.ttvClient.getRawChannels(),
                this.ttvClient.getRawChannelCategories(),
            ]);

            await this.appData.writeTtvSource(session, {
                lastFetched,
                rawChannels,
                rawChannelCategories,
            });

            const channels = buildTtvChannels(
                rawChannels,
                rawChannelCategories,
                this.groupsMap,
            );

            if (channels.length === 0) {
                logger.warn(`No TTV channels loaded`);
                return;
            }

            this.channelRepository.updateTtvChannels(channels);
            this.logger.debug(c => c`load > success ({bold ${channels.length.toString()}} channels)`);
        }
        catch (err) {
            this.logger.warn(`load > error`, [formatErrorMessage(err)]);
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

export { TtvSource }
