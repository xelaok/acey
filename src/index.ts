import { Server } from "hapi";
import nodeCleanup from "node-cleanup";
import { getConfig } from "./config";
import { logger, setupLogger } from "./libs/logger";
import { ChannelRepository } from "./services/ChannelRepository";
import { PlaylistFetcher } from "./services/PlaylistFetcher";
import { StreamProvider } from "./services/StreamProvider";
import * as routes from "./routes";

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
        logger.info(`Playlist url: ${config.server.publicPath}/all.m3u`);
        logger.info("Ready");
    });

    logger.verbose(`version               ${(process.env.appPackage as any).version}`);
    logger.verbose(`process id            ${process.pid}`);
    logger.verbose(`nodejs version        ${process.version}`);
    logger.verbose(`server.host           ${config.server.host}`);
    logger.verbose(`server.port           ${config.server.port}`);
    logger.verbose(`server.publicPath     ${config.server.publicPath}`);
    logger.verbose(`iproxy.path           ${config.iproxy.path}`);
    logger.verbose(`acePlaylist.url       ${config.playlistFetcher.acePlaylist.url}`);
    logger.verbose(`acePlaylist.interval  ${config.playlistFetcher.acePlaylist.interval}m`);
    logger.verbose(`logger.level          ${config.logger.level}`);

    logger.info("Fetching playlist...");
    await playlistFetcher.start();

    logger.info("Starting server...");
    await server.start();

    process.on("uncaughtException", err => {
        logger.warn(`Uncaught Exception > ${err.stack}`);
    });

    process.on('unhandledRejection', err => {
        logger.warn(`Unhandled Rejection > ${err.stack}`);
    });

    nodeCleanup(() => {
        console.log("");
        logger.info("Cleaning up...");
        playlistFetcher.stop();
        streamProvider.release();
        logger.info("Done.");
        return true;
    });
}
