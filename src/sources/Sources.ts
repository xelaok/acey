import { Dict } from "../base";
import { AppData } from "../app-data";
import { TtvApi } from "../ttv-api";
import { AceStreamRepository, TtvStreamRepository } from "../repositories";
import { Source } from "./types";
import { AceSource } from "./items/AceSource";
import { TtvSource } from "./items/TtvSource";

import {
    SourceConfig,
    AceUrlSourceConfig,
    TtvApiSourceConfig,
} from "../config";

import {
    StreamGroup,
    StreamSourceType,
    ClientStreamInfo,
} from "../types";

class Sources {
    private configs: Map<string, SourceConfig>;
    private sources: Map<string, Source>;

    constructor(
        sourceConfigs: Dict<SourceConfig>,
        groupsMap: Dict<StreamGroup>,
        appData: AppData,
        ttvApi: TtvApi,
        aceStreamRepository: AceStreamRepository,
        ttvStreamRepository: TtvStreamRepository,
    ) {
        this.configs = new Map();
        this.sources = new Map();

        for (const name in sourceConfigs) {
            const config = sourceConfigs[name];

            let source;

            switch (config.provider) {
                case StreamSourceType.Ace: {
                    const c = config as AceUrlSourceConfig;
                    source = new AceSource(
                        c.url,
                        c.updateInterval,
                        aceStreamRepository,
                        appData,
                        groupsMap,
                    );
                    break;
                }
                case StreamSourceType.Ttv: {
                    const c = config as TtvApiSourceConfig;
                    source = new TtvSource(
                        c.updateInterval,
                        ttvStreamRepository,
                        appData,
                        groupsMap,
                        ttvApi,
                    );
                    break;
                }
                default:
                    throw new Error(`Unknown source provider: "${config.provider}"`);
            }

            this.configs.set(name, config);
            this.sources.set(name, source);
        }
    }

    async start(): Promise<void> {
        await Promise.all(
            Array.from(this.sources.values()).map(source => source.start())
        );
    }

    stop(): void {
        Array.from(this.sources.values()).map(source => source.stop());
    }

    getStreamInfos(sources: string[]): ClientStreamInfo[] {
        const result = new Map<string, ClientStreamInfo>();

        for (const source of sources) {
            const sourceConfig = this.configs.get(source);

            if (!sourceConfig) {
                continue;
            }

            const sourceManager = this.sources.get(source);

            if (!sourceManager) {
                continue;
            }

            const streamsResult = sourceManager.getStreams();

            for (const stream of streamsResult.streams) {
                if (result.has(stream.name.toLowerCase())) {
                    continue;
                }

                result.set(stream.name.toLowerCase(), {
                    stream: stream,
                    streamType: streamsResult.streamType,
                    sourceLabel: sourceConfig.label,
                });
            }
        }

        return Array.from(result.values());
    }
}

export { Sources }
