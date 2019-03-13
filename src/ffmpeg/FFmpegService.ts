import { Readable } from "stream";
import { FFmpegConfig } from "../config";
import { FFmpegTask } from "./FFmpegTask";

class FFmpegService {
    private readonly config: FFmpegConfig;

    constructor(config: FFmpegConfig) {
        this.config = config;
    }

    createTask(args: string, input: Readable, alias: string): FFmpegTask {
        return new FFmpegTask(this.config, args, input, alias);
    }
}

export { FFmpegService }
