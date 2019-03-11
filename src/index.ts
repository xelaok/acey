import { sortBy } from "lodash";
import { FetchError } from "node-fetch";
import nodeCleanup from "node-cleanup";
import urlJoin from "url-join";
import { logger, setupLogger, forget } from "./base";
import { readConfig, Config } from "./config";
import { AppData } from "./app-data";
import { AceApi } from "./ace-api";
import { TtvApi } from "./ttv-api";
import { ChannelRepository } from "./channel-repository";
import { FFmpeg } from "./ffmpeg";
import { ChannelSources } from "./channel-sources";
import { Streaming } from "./streaming";
import { Progressive } from "./progressive";
import { Hls } from "./hls";
import { Server } from "./server";

main().catch(err => {
    logger.error(err);
});

async function main(): Promise<void> {
    const config = await readConfig();
    setupLogger(config.logger);

    const appData = new AppData(
        config.app,
    );

    const aceApi = new AceApi(
        config.aceApi,
    );

    const ttvApi = new TtvApi(
        config.ttvApi,
        appData,
    );

    const ffmpeg = new FFmpeg(
        config.ffmpeg,
    );

    const channelRepository = new ChannelRepository();

    const channelSources = new ChannelSources(
        config.channelSources,
        config.groupsMap,
        appData,
        ttvApi,
        channelRepository,
    );

    const streaming = new Streaming(
        config.stream,
        aceApi,
        ttvApi,
    );

    const progressive = new Progressive(
        config.progressive,
        streaming,
    );

    const hls = new Hls(
        config.hls,
        ffmpeg,
        streaming,
    );

    const server = new Server(
        config.server,
        config.groups,
        config.playlists,
        channelRepository,
        channelSources,
        progressive,
        hls,
    );

    logConfig(config, appData);

    await appData.init();
    await ttvApi.auth();
    await channelSources.open();
    await server.start();

    handleExceptions();
    handleCleanup(channelSources, streaming, hls);

    logPlaylists(config);
    logger.info("Ready");
}

function logConfig(config: Config, appData: AppData): void {
    logger.verbose(c => c`version          {bold ${(process.env.appPackage as any).version}}`);
    logger.verbose(c => c`process id       {bold ${process.pid.toString()}}`);
    logger.verbose(c => c`nodejs version   {bold ${process.version}}`);
    logger.verbose(c => c`app data         {bold ${appData.dataPath}}`);
    logger.verbose(c => c`server.binding   {bold ${config.server.binding}}`);
    logger.verbose(c => c`aceApi.endpoint  {bold ${config.aceApi.endpoint}}`);
    logger.verbose(c => c`ttvApi.endpoint  {bold ${config.ttvApi.endpoint}}`);
    logger.verbose(c => c`ffmpeg.binPath   {bold ${config.ffmpeg.binPath}}`);
    logger.verbose(c => c`ffmpeg.outPath   {bold ${config.ffmpeg.outPath}}`);
    logger.verbose(c => c`logger.level     {bold ${config.logger.level}}`);
    logger.verbose();
}

function logPlaylists(config: Config): void {
    const names = sortBy(Object.getOwnPropertyNames(config.playlists), name => name);

    if (names.length === 0) {
        return;
    }

    logger.info("Playlists:");

    for (const name of names) {
        logger.info(c => c`{gray -} {bold ${urlJoin("/", config.server.accessToken, name + ".m3u")}}`);
    }
}

function handleExceptions(): void {
    process.on("uncaughtException", err => {
        logger.warn(`Uncaught Exception > ${formatErrorMessage(err)}`);
    });

    process.on("unhandledRejection", err => {
        logger.warn(`Unhandled Rejection > ${formatErrorMessage(err)}`);
    });
}

function handleCleanup(channelSources: ChannelSources, streaming: Streaming, hls: Hls): void {
    nodeCleanup((exitCode, signal) => {
        console.log("");

        if (!signal) {
            return true;
        }

        nodeCleanup.uninstall();

        forget(async () => {
            try {
                logger.info("Cleaning up...");

                await Promise.all([
                    hls.close(),
                    streaming.close(),
                    channelSources.close(),
                ]);

                logger.info("Done.");
            }
            catch(err) {
                logger.error(err);
                logger.info("Done with errors.");
            }
            finally {
                process.kill(process.pid, signal);
            }
        });

        return false;
    });
}

function formatErrorMessage(err: any): string {
    switch (true) {
        case err instanceof FetchError:
            return err.message;
        default:
            return err.stack;
    }
}
