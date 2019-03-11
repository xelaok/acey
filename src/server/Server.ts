import Hapi from "hapi";
import { logger, Dict } from "../base";
import { ChannelGroup } from "../types";
import { PlaylistConfig, ServerConfig } from "../config";
import { ChannelRepository } from "../channel-repository";
import { ChannelSources } from "../channel-sources";
import { Progressive } from "../progressive";
import { Hls } from "../hls";
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
        progressiveDownload: Progressive,
        hls: Hls,
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
            hls,
        );

        routes.progressiveStream(
            server,
            serverConfig,
            channelRepository,
            progressiveDownload,
        );

        this.server = server;
    }

    async start(): Promise<void> {
        logger.info(c => "Starting server...");
        await this.server.start();
    }
}

export { Server }
