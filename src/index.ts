import { Server, Request, ResponseToolkit, ResponseObject, Plugin } from "hapi";
import * as consts from "./consts";
import { RejectedCids } from "./services/RejectedCids";
import { RejectedCidsCleaner } from "./services/RejectedCidsCleaner";
import { ChannelsRepository } from "./services/ChannelsRepository";
import { ChannelsLoader } from "./services/ChannelsLoader";
import { StreamPool } from "./services/StreamPool";
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
    const rejectedCids = new RejectedCids();
    const rejectedCidsCleaner = new RejectedCidsCleaner(rejectedCids);
    const channelsRepository = new ChannelsRepository(rejectedCids);
    const channelsLoader = new ChannelsLoader(
        consts.TTV_PLAYLIST_URL,
        consts.TTV_PLAYLIST_UPDATE_INTERVAL,
        channelsRepository,
    );
    const streamPool = new StreamPool(consts.IPROXY_PATH, channelsRepository);

    server.route({
        method: "GET",
        path: "/all.m3u",
        handler: (request: Request, h: ResponseToolkit) => {
            const streamsPath = `${consts.PUBLIC_PATH}/c`;

            const content = buildFullPlaylist(
                streamsPath,
                channelsRepository,
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
                channelsRepository,
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
            return streamPool.resolveRequest(request, h);
        },
    });

    await channelsLoader.start();

    rejectedCidsCleaner.start();
    server.start();
}
