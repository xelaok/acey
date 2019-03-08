import { PassThrough } from "stream";
import { Response } from "node-fetch";

type StreamRequest = {
    stream: PassThrough;
    response$: Promise<Response | null>;
};

export { StreamRequest }
