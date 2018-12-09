import { Server } from "hapi";
import { getConfig } from "./config";
import { logger, setupLogger } from "./libs/logger";
import { ChannelRepository } from "./services/ChannelRepository";
import { PlaylistFetcher } from "./services/PlaylistFetcher";
import { StreamProvider } from "./services/StreamProvider";
import * as routes from "./routes";

process.on("uncaughtException", err => {
    logger.warn(`Uncaught Exception > ${err.stack}`);
});

process.on('unhandledRejection', err => {
    logger.warn(`Unhandled Rejection > ${err.stack}`);
});

main().catch(err => {
    logger.error(err.stack);
});

async function main(): Promise<void> {
    const config = getConfig();

    setupLogger(config.logger);

    const server = new Server({
        host: config.server.host,
        port: config.server.port,
    });

    const channelRepository = new ChannelRepository();

    const playlistFetcher = new PlaylistFetcher(
        config.playlistFetcher,
        config.channelGroupsParseMap,
        channelRepository,
    );

    const streamProvider = new StreamProvider(
        config.stream,
        config.iproxy.path,
    );

    routes.handleGetPlaylist(
        server,
        config.server.publicPath,
        config.playlistFormat,
        config.channelGroups,
        channelRepository,
    );

    routes.handleGetChannelStream(
        server,
        channelRepository,
        streamProvider,
    );

    server.events.once("start", () => {
        logger.info("Ready");
    });

    logger.info("Fetching playlist...");
    await playlistFetcher.start();

    logger.info("Starting server...");
    await server.start();
}
