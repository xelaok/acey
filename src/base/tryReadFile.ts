import fs from "fs";
import { readStream } from "./readStream";

async function tryReadFile(path: string, highWaterMark: number): Promise<Buffer | null> {
    let chunks;

    try {
        const stream = fs.createReadStream(path, { highWaterMark });
        chunks = await readStream(stream);
    }
    catch (_) {
        chunks = null;
    }

    return chunks
        ? Buffer.concat(chunks)
        : null
        ;
}

export { tryReadFile }
