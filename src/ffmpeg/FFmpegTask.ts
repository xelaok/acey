import path from "path";
import { Readable } from "stream";
import { spawn, ChildProcess } from "child_process";
import fse from "fs-extra";
import { createLogger, createRandomIdGenerator, splitLines, forget, Logger, ChildProcessHelper } from "../base";
import { FFmpegConfig } from "../config";

const generateTempId = createRandomIdGenerator(62, 32);

class FFmpegTask {
    workingDirectory: string;
    onClosed: (() => void) | undefined;

    private readonly config: FFmpegConfig;
    private readonly args: string;
    private readonly input: Readable;
    private readonly logger: Logger;
    private isOpened: boolean;
    private process: ChildProcess | undefined;
    private processHelper: ChildProcessHelper | undefined;
    private processExitListener: (() => void) | undefined;

    constructor(config: FFmpegConfig, args: string, input: Readable, alias: string) {
        this.config = config;
        this.args = args;
        this.input = input;
        this.logger = createLogger(c => c`{bold ffmpeg > ${alias}}`);
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
        this.removeWorkingDirectory();
    }

    private async openProcess(): Promise<void> {
        this.logger.debug(c=> c`args: {bold ${this.args}}`);

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
            this.logger.debug(`exit`);

            this.process = undefined;
            this.processExitListener = undefined;
            this.processHelper = undefined;

            this.closeSelf();
        };

        process.stderr.on("data", data => {
            if (!this.config.logOutput) {
                return;
            }

            const lines = splitLines(data.toString(), true, true);

            for (const line of lines) {
                this.logger.debug(line);
            }
        });

        process.on("exit", processExitListener);

        process.stdin.on("error", (err) => {
            this.logger.silly(c => c`stdin error: {bold ${err.toString()}}`);
        });

        process.stdout.on("error", (err) => {
            this.logger.silly(c => c`stdout error: {bold ${err.toString()}}`);
        });

        this.input.pipe(process.stdin);

        this.process = process;
        this.processHelper = processHelper;
        this.processExitListener = processExitListener;
    }

    private closeSelf(): void {
        forget(this.close());
        this.onClosed && this.onClosed();
    }

    private async killProcess(): Promise<void> {
        if (!this.process || !this.processHelper || !this.processExitListener) {
            return;
        }

        this.logger.debug(`kill`);

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
        this.logger.debug(c => c`create dir {bold ${this.workingDirectory}}`);
        await fse.mkdirp(this.workingDirectory);
    }

    private removeWorkingDirectory(): void {
        this.logger.debug(c => c`remove dir {bold ${this.workingDirectory}}`);
        fse.removeSync(this.workingDirectory);
    }
}

export { FFmpegTask }
