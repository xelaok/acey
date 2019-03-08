import path from "path";
import { Readable } from "stream";
import { spawn, ChildProcess } from "child_process";
import fse from "fs-extra";
import { logger, delay, getRandomIdGenerator, splitLines, ChildProcessHelper } from "../base";
import { FFmpegConfig } from "../config";

const generateTempId = getRandomIdGenerator(62, 32);

class FFmpegWorker {
    workingDirectory: string;
    onClosed: (() => void) | undefined;

    private readonly config: FFmpegConfig;
    private readonly args: string;
    private readonly input: Readable;
    private readonly alias: string;
    private isOpened: boolean;
    private process: ChildProcess | undefined;
    private processHelper: ChildProcessHelper | undefined;
    private processExitListener: (() => void) | undefined;

    constructor(config: FFmpegConfig, args: string, input: Readable, alias: string) {
        this.config = config;
        this.args = args;
        this.input = input;
        this.alias = alias;
        this.isOpened = false;
        this.workingDirectory = path.join(this.config.outPath, "acey-ffmpeg-" + generateTempId());
    }

    async open(): Promise<void> {
        if (this.isOpened) {
            return;
        }

        this.isOpened = true;

        await this.createWorkingDirectory();
        await this.openProcess();
    }

    async close(): Promise<void> {
        if (!this.isOpened) {
            return;
        }

        this.isOpened = false;

        await this.killProcess();
        await this.removeWorkingDirectory();
    }

    private async openProcess(): Promise<void> {
        logger.debug(`ffmpeg > ${this.alias} > args: ${this.args}`);

        const process = spawn(
            this.config.binPath,
            this.args.split(" "),
            {
                cwd: this.workingDirectory,
                windowsHide: true,
            },
        );

        const processHelper = new ChildProcessHelper(process);

        const processExitListener = async () => {
            logger.debug(`ffmpeg > ${this.alias} > exit`);
            await this.close();
            this.onClosed && this.onClosed();
        };

        process.stderr.on("data", data => {
            if (!this.config.logOutput) {
                return;
            }

            const lines = splitLines(data.toString(), true, true);

            for (const line of lines) {
                logger.debug(`ffmpeg > ${this.alias} > ${line}`);
            }
        });

        process.on("exit", processExitListener);

        process.stdin.on("error", (err) => {
            logger.silly(`ffmpeg > ${this.alias} > stdin > ${err}`);
        });

        process.stdout.on("error", (err) => {
            logger.silly(`ffmpeg > ${this.alias} > stdout > ${err}`);
        });

        this.input.pipe(process.stdin);

        this.process = process;
        this.processHelper = processHelper;
        this.processExitListener = processExitListener;
    }

    private async killProcess(): Promise<void> {
        if (!this.process || !this.processHelper || !this.processExitListener) {
            return;
        }

        logger.debug(`ffmpeg > ${this.alias} > kill`);

        const process = this.process;
        const processHelper = this.processHelper;
        const processExitListener = this.processExitListener;

        this.process = undefined;
        this.processHelper = undefined;
        this.processExitListener = undefined;

        process.removeListener("exit", processExitListener);
        process.kill("SIGKILL");

        await processHelper.waitExit();
    }

    private async createWorkingDirectory(): Promise<void> {
        logger.debug(`ffmpeg > ${this.alias} > create dir ${this.workingDirectory}`);
        await fse.mkdirp(this.workingDirectory);
    }

    private async removeWorkingDirectory(): Promise<void> {
        logger.debug(`ffmpeg > ${this.alias} > remove dir ${this.workingDirectory}`);
        await fse.remove(this.workingDirectory);
    }
}

export { FFmpegWorker }
