import Hapi from "hapi";
import { Dict, logger } from "../base";
import { TtvApi } from "../ttv-api";
import { StreamGroup } from "../types";
import { PlaylistConfig, ServerConfig } from "../config";
import { AceStreamRepository, TtvStreamRepository } from "../repositories";
import { Sources } from "../sources";
import { Streams } from "../streams";
import * as routes from "./routes";

class Server {
    private server: Hapi.Server;

    constructor(
        serverConfig: ServerConfig,
        groups: StreamGroup[],
        playlistConfigs: Dict<PlaylistConfig>,
        ttvApi: TtvApi,
        aceStreamRepository: AceStreamRepository,
        ttvStreamRepository: TtvStreamRepository,
        sources: Sources,
        streams: Streams,
    ) {
        const [host, port] = serverConfig.binding.split(":");

        this.server = new Hapi.Server({
            host,
            port,
        });

        routes.handleGetPlaylist(
            this.server,
            serverConfig,
            groups,
            playlistConfigs,
            sources,
        );

        routes.handleGetStream(
            this.server,
            ttvApi,
            aceStreamRepository,
            ttvStreamRepository,
            streams,
        );
    }

    async start(): Promise<void> {
        logger.info("Starting server...");
        await this.server.start();
    }
}

export { Server }
