import { Readable } from "stream";
import { FFmpegConfig } from "../config";
import { FFmpegWorker } from "./FFmpegWorker";

class FFmpeg {
    private readonly ffmpegConfig: FFmpegConfig;

    constructor(ffmpegConfig: FFmpegConfig) {
        this.ffmpegConfig = ffmpegConfig;
    }

    createWorker(args: string, input: Readable, alias: string): FFmpegWorker {
        return new FFmpegWorker(this.ffmpegConfig, args, input, alias);
    }
}

export { FFmpeg }
