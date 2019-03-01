import Hapi from "hapi";
import { Dict, logger, getTime, getTimeDiff } from "../base";
import { ChannelGroup } from "../types";
import { PlaylistConfig, ServerConfig } from "../config";
import { ChannelRepository } from "../channel-repository";
import { ChannelSources } from "../channel-sources";
import { Progressive } from "../progressive";
import { Hls } from "../hls";
import * as routes from "./routes";

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

        this.server = new Hapi.Server({
            host,
            port,
            routes: {
                cors: true,
            },
        });

        if (serverConfig.logRequests) {
            const requestTimeMap = new Map<Hapi.Request, number | [number, number]>();

            this.server.ext({
                type: 'onRequest',
                method: function (req, h) {
                    requestTimeMap.set(req, getTime());
                    logger.debug(`${req.method.toUpperCase()} ${req.url.pathname} ..`);
                    return h.continue;
                }
            });

            this.server.ext({
                type: 'onPreResponse',
                method: function (req, h) {
                    if (!req.response) {
                        return h.continue;
                    }

                    const time = requestTimeMap.get(req);
                    const timeDiff = time && getTimeDiff(time);
                    const seconds = timeDiff && (timeDiff / 1000).toFixed(3) + "s";
                    const statusCode = (req.response as Hapi.ResponseObject).statusCode;

                    requestTimeMap.delete(req);

                    logger.debug(`${req.method.toUpperCase()} ${req.url.pathname} > ${statusCode ? statusCode : "---"} ${seconds && "(" + seconds + ")"}`);
                    return h.continue;
                }
            });
        }

        routes.playlist(
            this.server,
            serverConfig,
            groups,
            playlistConfigs,
            channelSources,
        );

        routes.hlsStream(
            this.server,
            channelRepository,
            hls,
        );

        routes.progressiveStream(
            this.server,
            channelRepository,
            progressiveDownload,
        );
    }

    async start(): Promise<void> {
        logger.info("Starting server...");
        await this.server.start();
    }
}

export { Server }
