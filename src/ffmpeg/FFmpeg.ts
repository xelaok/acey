import { FFmpegConfig } from "../config";
import { FFmpegWorker } from "./FFmpegWorker";

class FFmpeg {
    private readonly ffmpegConfig: FFmpegConfig;

    constructor(ffmpegConfig: FFmpegConfig) {
        this.ffmpegConfig = ffmpegConfig;
    }

    createWorker(): FFmpegWorker {
        return new FFmpegWorker(this.ffmpegConfig);
    }
}

export { FFmpeg }
