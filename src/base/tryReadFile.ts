import fs from "fs";
import { readStream } from "./readStream";

async function tryReadFile(filename: string, highWaterMark: number): Promise<Buffer | null> {
    let chunks;

    try {
        const stream = fs.createReadStream(filename, { highWaterMark });
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
