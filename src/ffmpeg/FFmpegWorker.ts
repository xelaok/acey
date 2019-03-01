import path from "path";
import { Readable } from "stream";
import { spawn, ChildProcess } from "child_process";
import fse from "fs-extra";
import { logger, forget, getRandomIdGenerator, splitLines, ChildProcessHelper } from "../base";
import { FFmpegConfig } from "../config";

const generateTempId = getRandomIdGenerator(62, 32);

class FFmpegWorker {
    workingDirectory: string;
    onFinish: (() => void) | undefined;

    private readonly ffmpegConfig: FFmpegConfig;
    private isExecuting: boolean = false;
    private ffmpegProcess: ChildProcess | undefined;
    private ffmpegProcessHelper: ChildProcessHelper | undefined;

    constructor(ffmpegConfig: FFmpegConfig) {
        this.ffmpegConfig = ffmpegConfig;
        this.workingDirectory = path.join(this.ffmpegConfig.outPath, "acey-ffmpeg-" + generateTempId());
    }

    async run(args: string, input: Readable): Promise<void> {
        if (this.isExecuting) {
            return;
        }

        this.isExecuting = true;

        await this.createWorkingDirectory();

        if (this.ffmpegConfig.logOutput) {
            logger.debug(`ffmpeg > args: ${args}`);
        }

        const ffmpegProcess = spawn(
            this.ffmpegConfig.binPath,
            args.split(" "),
            {
                cwd: this.workingDirectory,
                windowsHide: true,
            },
        );

        const ffmpegProcessHelper = new ChildProcessHelper(ffmpegProcess);

        this.ffmpegProcess = ffmpegProcess;
        this.ffmpegProcessHelper = ffmpegProcessHelper;

        ffmpegProcess.stderr.on("data", data => {
            if (!this.ffmpegConfig.logOutput) {
                return;
            }

            const lines = splitLines(data.toString(), true, true);

            for (const line of lines) {
                logger.debug(`ffmpeg > ${line}`);
            }
        });

        ffmpegProcess.on("exit", () => {
            logger.debug("ffmpeg > exit");

            if (!this.isExecuting) {
                return;
            }

            this.isExecuting = false;
            this.ffmpegProcess = undefined;
            this.ffmpegProcessHelper = undefined;

            forget(this.removeWorkingDirectory());

            if (this.onFinish) {
                this.onFinish();
            }
        });

        ffmpegProcess.stdin.on("error", (err) => {
            logger.silly(`ffmpeg > stdin > ${err}`);
        });

        ffmpegProcess.stdout.on("error", (err) => {
            logger.silly(`ffmpeg > stdout > ${err}`);
        });

        input.pipe(ffmpegProcess.stdin);
    }

    async close(): Promise<void> {
        if (!this.isExecuting) {
            return;
        }

        const ffmpegProcess = this.ffmpegProcess;
        const ffmpegProcessHelper = this.ffmpegProcessHelper;

        this.isExecuting = false;
        this.ffmpegProcess = undefined;
        this.ffmpegProcessHelper = undefined;

        if (ffmpegProcess && !ffmpegProcess.killed) {
            logger.debug("ffmpeg > kill");
            ffmpegProcess.kill("SIGKILL");
        }

        if (ffmpegProcessHelper) {
            await ffmpegProcessHelper.waitExit();
        }

        await this.removeWorkingDirectory();

        if (this.onFinish) {
            this.onFinish();
        }
    }

    private async createWorkingDirectory(): Promise<void> {
        logger.debug("ffmpeg > create dir: " + this.workingDirectory);
        await fse.mkdirp(this.workingDirectory);
    }

    private async removeWorkingDirectory(): Promise<void> {
        logger.debug("ffmpeg > remove dir: " + this.workingDirectory);
        await fse.remove(this.workingDirectory);
    }
}

export { FFmpegWorker }
