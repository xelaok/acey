import { PassThrough } from "stream";
import { Headers } from "node-fetch";

type StreamClient = {
    stream: PassThrough;
    responseHeaders: Headers;
};

export { StreamClient }
