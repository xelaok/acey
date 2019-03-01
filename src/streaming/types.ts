import { PassThrough } from "stream";
import { Response } from "node-fetch";

type StreamRequestResult = {
    stream: PassThrough;
    response$: Promise<Response | null>;
};

export { StreamRequestResult }
