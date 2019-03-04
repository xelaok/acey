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
    logger.error(err.stack);
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

    const progressiveDownload = new Progressive(
        config.progressiveDownload,
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
        progressiveDownload,
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
    logger.verbose(`version          ${(process.env.appPackage as any).version}`);
    logger.verbose(`process id       ${process.pid}`);
    logger.verbose(`nodejs version   ${process.version}`);
    logger.verbose(`app data         ${appData.dataPath}`);
    logger.verbose(`server.binding   ${config.server.binding}`);
    logger.verbose(`aceApi.endpoint  ${config.aceApi.endpoint}`);
    logger.verbose(`ttvApi.endpoint  ${config.ttvApi.endpoint}`);
    logger.verbose(`ffmpeg.binPath   ${config.ffmpeg.binPath}`);
    logger.verbose(`ffmpeg.outPath   ${config.ffmpeg.outPath}`);
    logger.verbose(`logger.level     ${config.logger.level}`);
}

function logPlaylists(config: Config): void {
    const names = sortBy(Object.getOwnPropertyNames(config.playlists), name => name);

    if (names.length === 0) {
        return;
    }

    logger.info("Playlists:");

    for (const name of names) {
        logger.info(`- ${urlJoin("/", config.server.accessToken, name + ".m3u")}`);
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
                    channelSources.close(),
                    hls.close(),
                    streaming.close(),
                ]);

                logger.info("Done.");
            }
            catch(err) {
                logger.warn(err);
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
