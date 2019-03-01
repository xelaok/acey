import { Readable } from "stream";
import streamToArray from "stream-to-array";

async function readStream(readable: Readable): Promise<Buffer> {
    const chunks = await streamToArray(readable);
    return Buffer.concat(chunks);
}

export { readStream }
