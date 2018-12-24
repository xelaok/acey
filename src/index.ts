import _ from "lodash";
import { FetchError } from "node-fetch";
import nodeCleanup from "node-cleanup";
import { logger, setupLogger, forget } from "./base";
import { readConfig, Config } from "./config";
import { AppData } from "./app-data";
import { TtvApi } from "./ttv-api";
import { AceStreamRepository, TtvStreamRepository } from "./repositories";
import { Sources } from "./sources";
import { Streams } from "./streams";
import { Server } from "./server";

main().catch(err => {
    logger.error(err.stack);
});

async function main(): Promise<void> {
    const config = await readConfig();

    setupLogger(config.logger);

    const appData = new AppData(config.app);
    const ttvApi = new TtvApi(config.ttvApi, appData);
    const aceStreamRepository = new AceStreamRepository();
    const ttvStreamRepository = new TtvStreamRepository();

    const sources = new Sources(
        config.sources,
        config.groupsMap,
        appData,
        ttvApi,
        aceStreamRepository,
        ttvStreamRepository,
    );

    const streams = new Streams(
        config.stream,
        config.aceEngine,
    );

    const server = new Server(
        config.server,
        config.groups,
        config.playlists,
        ttvApi,
        aceStreamRepository,
        ttvStreamRepository,
        sources,
        streams,
    );

    logConfig(config);

    await appData.init();
    await ttvApi.auth();
    await sources.start();
    await server.start();

    handleExceptions();
    handleTermination(sources, streams);

    logPlaylists(config);
    logger.info("Ready");
}

function logConfig(config: Config) {
    logger.verbose(`version            ${(process.env.appPackage as any).version}`);
    logger.verbose(`process id         ${process.pid}`);
    logger.verbose(`nodejs version     ${process.version}`);
    logger.verbose(`server.binding     ${config.server.binding}`);
    logger.verbose(`server.publicPath  ${config.server.publicPath}`);
    logger.verbose(`aceEngine.path     ${config.aceEngine.path}`);
    logger.verbose(`logger.level       ${config.logger.level}`);
}

function logPlaylists(config: Config): void {
    const names = _.sortBy(Object.getOwnPropertyNames(config.playlists), name => name);

    if (names.length === 0) {
        return;
    }

    logger.info("Playlists:");

    for (const name of names) {
        logger.info(`- ${config.server.publicPath}/${name}.m3u`);
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

function handleTermination(sources: Sources, streams: Streams): void {
    nodeCleanup((exitCode, signal) => {
        console.log("");

        if (!signal) {
            return true;
        }

        nodeCleanup.uninstall();

        forget(async () => {
            try {
                logger.info("Cleaning up...");

                sources.stop();
                await streams.dispose();

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
