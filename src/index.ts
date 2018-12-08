import { Server, Request, ResponseToolkit } from "hapi";
import * as consts from "./consts";
import { ChannelRepository } from "./services/ChannelRepository";
import { ChannelsLoader } from "./services/ChannelsLoader";
import { ChannelPool } from "./services/ChannelPool";
import { buildFullPlaylist } from "./utils/buildFullPlaylist";
import { buildSelectedPlaylist } from "./utils/buildSelectedPlaylist";

main();

async function main(): Promise<void> {
    process.on("uncaughtException", err => {
        console.log(err);
    });

    const server = new Server({
        host: consts.BIND_HOST,
        port: consts.BIND_PORT,
    });
    const channelRepository = new ChannelRepository();
    const channelsLoader = new ChannelsLoader(
        consts.ACE_PLAYLIST_URL,
        consts.ACE_PLAYLIST_UPDATE_INTERVAL,
        channelRepository,
    );
    const channelPool = new ChannelPool(consts.IPROXY_PATH, channelRepository);

    server.route({
        method: "GET",
        path: "/all.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            const streamsPath = `${consts.PUBLIC_PATH}/c`;

            const content = buildFullPlaylist(
                streamsPath,
                channelRepository,
            );

            return h
                .response(content)
                .header("content-type", "text/plain; charset=utf-8")
                ;
        },
    });

    server.route({
        method: "GET",
        path: "/selected.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            const streamsPath = `${consts.PUBLIC_PATH}/c`;

            const content = buildSelectedPlaylist(
                streamsPath,
                consts.selectedChannelsSet,
                channelRepository,
            );

            return h
                .response(content)
                .header("content-type", "text/plain; charset=utf-8")
                ;
        },
    });

    server.route({
        method: "GET",
        path: "/c/{channelId}",
        handler: (request: Request, h: ResponseToolkit) => {
            return channelPool.resolveRequest(request, h, consts.CLIENT_IDLE_TIMEOUT);
        },
    });

    await channelsLoader.start();
    await server.start();
}
