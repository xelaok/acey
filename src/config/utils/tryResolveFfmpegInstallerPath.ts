function tryResolveFfmpegInstallerPath(): string | null {
    try {
        const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
        return ffmpegInstaller.path;
    }
    catch (err) {
        return null;
    }
}

export { tryResolveFfmpegInstallerPath }
