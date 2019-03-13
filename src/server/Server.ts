import Hapi from "hapi";
import { logger, Dict } from "../base";
import { ChannelGroup } from "../types";
import { PlaylistConfig, ServerConfig } from "../config";
import { ChannelRepository } from "../channel-repository";
import { ChannelSources } from "../channel-sources";
import { ProgressiveService } from "../progressive";
import { HlsService } from "../hls";
import * as routes from "./routes";
import { handleLogRequests } from "./utils/handleLogRequests";

class Server {
    private readonly server: Hapi.Server;

    constructor(
        serverConfig: ServerConfig,
        groups: ChannelGroup[],
        playlistConfigs: Dict<PlaylistConfig>,
        channelRepository: ChannelRepository,
        channelSources: ChannelSources,
        progressiveService: ProgressiveService,
        hlsService: HlsService,
    ) {
        const [host, port] = serverConfig.binding.split(":");

        const server = new Hapi.Server({
            host,
            port,
            routes: {
                cors: true,
            },
        });

        if (serverConfig.logRequests) {
            handleLogRequests(server);
        }

        routes.playlist(
            server,
            serverConfig,
            groups,
            playlistConfigs,
            channelSources,
        );

        routes.hlsStream(
            server,
            serverConfig,
            channelRepository,
            hlsService,
        );

        routes.progressiveStream(
            server,
            serverConfig,
            channelRepository,
            progressiveService,
        );

        this.server = server;
    }

    start(): Promise<void> {
        logger.info(c => "Starting server...");
        return this.server.start();
    }
}

export { Server }
