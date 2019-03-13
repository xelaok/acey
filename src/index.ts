import nodeCleanup from "node-cleanup";
import urlJoin from "url-join";
import { sortBy } from "lodash";
import { logger, setupLogger, forget } from "./base";
import { readConfig, Config } from "./config";
import { AppData } from "./app-data";
import { AceClient } from "./ace-client";
import { TtvClient } from "./ttv-client";
import { ChannelRepository } from "./channel-repository";
import { FFmpegService } from "./ffmpeg";
import { ChannelSources } from "./channel-sources";
import { StreamService } from "./stream";
import { ProgressiveService } from "./progressive";
import { HlsService } from "./hls";
import { Server } from "./server";

main().catch(err => {
    logger.error(err.stack);
});

async function main(): Promise<void> {
    const config = await readConfig();
    setupLogger(config.logger);

    const appData = new AppData(
        config.app,
    );

    const aceClient = new AceClient(
        config.aceApi,
    );

    const ttvClient = new TtvClient(
        config.ttvApi,
        appData,
    );

    const ffmpegService = new FFmpegService(
        config.ffmpeg,
    );

    const channelRepository = new ChannelRepository();

    const channelSources = new ChannelSources(
        config.channelSources,
        config.groupsMap,
        appData,
        ttvClient,
        channelRepository,
    );

    const streamService = new StreamService(
        config.stream,
        aceClient,
        ttvClient,
    );

    const progressiveService = new ProgressiveService(
        config.progressive,
        streamService,
    );

    const hlsService = new HlsService(
        config.hls,
        ffmpegService,
        streamService,
    );

    const server = new Server(
        config.server,
        config.groups,
        config.playlists,
        channelRepository,
        channelSources,
        progressiveService,
        hlsService,
    );

    logConfig(config, appData);

    await appData.init();
    await ttvClient.auth();
    await channelSources.open();
    await server.start();

    handleExceptions();
    handleCleanup(channelSources, streamService, hlsService);

    logPlaylists(config);
    logger.info("Ready");
}

function logConfig(config: Config, appData: AppData): void {
    logger.verbose(c => c`version          {bold ${process.env.appVersion as string}}`);
    logger.verbose(c => c`process id       {bold ${process.pid.toString()}}`);
    logger.verbose(c => c`nodejs version   {bold ${process.version}}`);
    logger.verbose(c => c`app data         {bold ${appData.dataPath}}`);
    logger.verbose(c => c`server.binding   {bold ${config.server.binding}}`);
    logger.verbose(c => c`aceApi.endpoint  {bold ${config.aceApi.endpoint}}`);
    logger.verbose(c => c`ttvApi.endpoint  {bold ${config.ttvApi.endpoint}}`);
    logger.verbose(c => c`ffmpeg.binPath   {bold ${config.ffmpeg.binPath}}`);
    logger.verbose(c => c`ffmpeg.outPath   {bold ${config.ffmpeg.outPath}}`);
    logger.verbose(c => c`logger.level     {bold ${config.logger.level}}`);
}

function logPlaylists(config: Config): void {
    const names = sortBy(Object.getOwnPropertyNames(config.playlists), name => name);

    if (names.length === 0) {
        return;
    }

    logger.info(`Playlists:`, c => names.map(name =>
        c`{bold ${urlJoin("/", config.server.accessToken, name + ".m3u")}}`
    ));
}

function handleExceptions(): void {
    process.on("uncaughtException", err => {
        logger.warn(c => c`{bold Uncaught Exception}`);
        logger.warn(err.stack);
    });

    process.on("unhandledRejection", err => {
        logger.warn(c => c`{bold Unhandled Rejection}`);
        logger.warn(err.stack || err);
    });
}

function handleCleanup(
    channelSources: ChannelSources,
    streamService: StreamService,
    hlsService: HlsService,
): void {
    nodeCleanup((exitCode, signal) => {
        console.log("");

        if (!signal) {
            return true;
        }

        nodeCleanup.uninstall();

        forget(async () => {
            logger.info("Cleaning up...");
            try {
                await Promise.all([
                    hlsService.close(),
                    streamService.close(),
                    channelSources.close(),
                ]);

                logger.info("Done.");
            }
            catch(err) {
                logger.error(err.stack || err);
                logger.info("Done with errors.");
            }
            finally {
                process.kill(process.pid, signal);
            }
        });

        return false;
    });
}
