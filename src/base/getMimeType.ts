import path from "path";
import mime from "mime-types";

function getMimeType(filename: string): string | null {
    switch (path.extname(filename)) {
        case ".m3u8":
            return "application/vnd.apple.mpegurl";
        case ".mp4":
        case ".m4s":
            return "video/mp4";
        case ".ts":
            return "video/mp2t";
        default:
            return mime.lookup(filename) || null;
    }
}

export { getMimeType }
