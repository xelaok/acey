import { Readable } from "stream";

async function readStream(readable: Readable): Promise<Uint8Array[]> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        listen();

        function listen(): void {
            readable.on("data",onData);
            readable.on("end", onEnd);
            readable.on("close", onClose);
            readable.on("error", onError);
        }

        function unlisten(): void {
            readable.removeListener("data",onData);
            readable.removeListener("end", onEnd);
            readable.removeListener("close", onClose);
            readable.removeListener("error", onError);
        }

        function onData(chunk: Uint8Array): void {
            chunks.push(chunk);
        }

        function onEnd(): void {
            unlisten();
            resolve(chunks);
        }

        function onClose(): void {
            unlisten();
            resolve(chunks);
        }

        function onError(err: any): void {
            unlisten();
            reject(err);
        }
    });
}

export { readStream }
